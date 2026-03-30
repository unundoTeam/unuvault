import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, stderr } from "node:process";
import {
  exchangeDevSecretsHandoff,
  readDevSecretRecord,
  writeDevSecretRecord,
} from "../../packages/api-client/src/dev-secrets";
import {
  isSupportedDevSecretProviderTarget,
  listSupportedDevSecretNamespaces,
} from "../../packages/api-client/src/dev-secrets-targets";
import {
  openDeveloperSecretBlob,
  sealDeveloperSecretBlob,
} from "../../packages/security/src/developer-secret-envelope";

type ProviderTarget = {
  app: string;
  env: string;
};

type ProviderCommand =
  | {
      kind: "read";
      target: ProviderTarget;
    }
  | {
      kind: "import";
      target: ProviderTarget;
      from: string;
    };

type ProviderIo = {
  writeStdout(value: string): void;
  writeStderr(value: string): void;
};

type ProviderDeps = {
  getCliSessionToken(target: ProviderTarget): Promise<string>;
  promptSecret(prompt: string): Promise<string>;
  readRecord(
    cliSessionToken: string,
    target: ProviderTarget,
  ): Promise<{ ciphertext: string }>;
  writeRecord(
    cliSessionToken: string,
    target: ProviderTarget,
    ciphertext: string,
  ): Promise<{ ok: true }>;
  readTextFile(path: string): Promise<string>;
  confirm(prompt: string): Promise<boolean>;
  digest(text: string): string;
};

type RunOptions = {
  io?: ProviderIo;
  deps?: Partial<ProviderDeps>;
  env?: NodeJS.ProcessEnv;
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_WEB_BASE_URL = "http://127.0.0.1:3001";
export const DEV_SECRETS_PROVIDER_USAGE = [
  "Usage:",
  "  bash scripts/secrets/provider.sh read --app unundo --env local",
  "  bash scripts/secrets/provider.sh read --app unuidentity --env local",
  "  bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env",
  "  bash scripts/secrets/provider.sh import --app unuidentity --env local --from /absolute/path/to/phase1.env",
  `Supported namespaces: ${listSupportedDevSecretNamespaces().join(", ")}`,
].join("\n");

function createProviderError(code: string) {
  return new Error(code);
}

function validateTarget(target: ProviderTarget) {
  if (!isSupportedDevSecretProviderTarget(target)) {
    throw createProviderError("invalid_target");
  }
}

function validateConservativeDotenv(payload: string) {
  const lines = payload.split(/\r?\n/);

  if (payload.trim().length === 0) {
    throw createProviderError("invalid_dotenv_payload");
  }

  for (const line of lines) {
    if (line.length === 0 || line.trim().length === 0) {
      continue;
    }

    if (line.trimStart().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      throw createProviderError("invalid_dotenv_payload");
    }

    const key = line.slice(0, separatorIndex);

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw createProviderError("invalid_dotenv_payload");
    }
  }
}

function parseProviderCommand(argv: string[]): ProviderCommand {
  if (argv.includes("--help") || argv.includes("-h")) {
    throw createProviderError("help");
  }

  const [kind, ...rest] = argv;

  if (kind !== "read" && kind !== "import") {
    throw createProviderError("invalid_command");
  }

  let app = "";
  let env = "";
  let from = "";

  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];
    const next = rest[index + 1] ?? "";

    if (current === "--app") {
      app = next;
      index += 1;
      continue;
    }

    if (current === "--env") {
      env = next;
      index += 1;
      continue;
    }

    if (current === "--from") {
      from = next;
      index += 1;
      continue;
    }
  }

  const target = { app, env };

  validateTarget(target);

  if (kind === "read") {
    return {
      kind,
      target,
    };
  }

  if (!from || !isAbsolute(from)) {
    throw createProviderError("invalid_file_path");
  }

  return {
    kind,
    target,
    from,
  };
}

function createFetchWithBaseUrl(baseUrl: string) {
  return async (
    input: string,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ) => {
    return fetch(new URL(input, baseUrl), init);
  };
}

function readApiBaseUrl(env: NodeJS.ProcessEnv) {
  return env.UNUVAULT_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function readWebBaseUrl(env: NodeJS.ProcessEnv) {
  return env.UNUVAULT_WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL;
}

async function promptLine(prompt: string) {
  if (!stdin.isTTY || !stderr.isTTY) {
    throw createProviderError("not_interactive_tty");
  }

  const rl = createInterface({
    input: stdin,
    output: stderr,
  });

  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function confirmPrompt(prompt: string) {
  const answer = await promptLine(`${prompt} [y/N] `);

  return answer.trim().toLowerCase() === "y";
}

async function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command[0]!, command.slice(1), {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", () => reject(createProviderError("browser_open_failed")));
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function waitForLoopbackCode(target: ProviderTarget, env: NodeJS.ProcessEnv) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw createProviderError("not_interactive_tty");
  }

  const webBaseUrl = readWebBaseUrl(env);
  const state = randomUUID();

  return new Promise<string>((resolve, reject) => {
    let resolved = false;
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const code = requestUrl.searchParams.get("code") ?? "";
      const returnedState = requestUrl.searchParams.get("state") ?? "";

      if (returnedState !== state) {
        response.statusCode = 400;
        response.end("callback_state_mismatch");
        cleanup(createProviderError("callback_state_mismatch"));
        return;
      }

      response.statusCode = 200;
      response.end("unuvault CLI connected. You can return to your terminal.");
      cleanup(undefined, code);
    });

    const timeout = setTimeout(() => {
      cleanup(createProviderError("login_timeout"));
    }, 120_000);

    function cleanup(error?: Error, code?: string) {
      if (resolved) {
        return;
      }

      resolved = true;
      clearTimeout(timeout);
      server.close();

      if (error) {
        reject(error);
        return;
      }

      resolve(code ?? "");
    }

    server.once("error", () => {
      cleanup(createProviderError("callback_bind_failed"));
    });

    server.listen(0, "127.0.0.1", async () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        cleanup(createProviderError("callback_bind_failed"));
        return;
      }

      const callbackUrl = new URL("/callback", `http://127.0.0.1:${address.port}`);
      const handoffUrl = new URL("/dev/secrets/handoff", webBaseUrl);

      handoffUrl.searchParams.set("callback", callbackUrl.toString());
      handoffUrl.searchParams.set("state", state);
      handoffUrl.searchParams.set("app", target.app);
      handoffUrl.searchParams.set("env", target.env);

      stderr.write("Opening browser for unuvault login...\n");

      try {
        await openBrowser(handoffUrl.toString());
      } catch (error) {
        cleanup(
          error instanceof Error
            ? error
            : createProviderError("browser_open_failed"),
        );
      }
    });
  });
}

function createDefaultDeps(env: NodeJS.ProcessEnv): ProviderDeps {
  const apiFetch = createFetchWithBaseUrl(readApiBaseUrl(env));

  return {
    async getCliSessionToken(target) {
      const existingToken = env.UNUVAULT_DEV_SECRETS_CLI_SESSION_TOKEN;

      if (existingToken) {
        return existingToken;
      }

      const handoffCode = await waitForLoopbackCode(target, env);
      const exchange = await exchangeDevSecretsHandoff(apiFetch, handoffCode);

      return exchange.cli_session_token;
    },

    async promptSecret(prompt) {
      return promptLine(prompt);
    },

    async readRecord(cliSessionToken, target) {
      return readDevSecretRecord(apiFetch, cliSessionToken, target);
    },

    async writeRecord(cliSessionToken, target, ciphertext) {
      return writeDevSecretRecord(apiFetch, cliSessionToken, {
        ...target,
        ciphertext,
      });
    },

    async readTextFile(path) {
      return readFile(path, "utf8");
    },

    async confirm(prompt) {
      return confirmPrompt(prompt);
    },

    digest(text) {
      return createHash("sha256").update(text).digest("hex");
    },
  };
}

async function runReadCommand(
  command: Extract<ProviderCommand, { kind: "read" }>,
  io: ProviderIo,
  deps: ProviderDeps,
) {
  const cliSessionToken = await deps.getCliSessionToken(command.target);
  const record = await deps.readRecord(cliSessionToken, command.target);
  const masterPassword = await deps.promptSecret("Master password: ");
  const plaintext = openDeveloperSecretBlob(record.ciphertext, masterPassword);

  if (!plaintext) {
    throw createProviderError("decrypt_failed");
  }

  validateConservativeDotenv(plaintext);
  io.writeStdout(plaintext);
}

async function runImportCommand(
  command: Extract<ProviderCommand, { kind: "import" }>,
  io: ProviderIo,
  deps: ProviderDeps,
) {
  const plaintext = await deps.readTextFile(command.from);

  validateConservativeDotenv(plaintext);

  io.writeStderr(`Target: ${command.target.app}/${command.target.env}/dotenv\n`);
  io.writeStderr(`Source: ${command.from}\n`);
  io.writeStderr(`Size: ${Buffer.byteLength(plaintext, "utf8")} bytes\n`);
  io.writeStderr(`SHA256: ${deps.digest(plaintext)}\n`);

  const confirmed = await deps.confirm("Replace existing ciphertext?");

  if (!confirmed) {
    throw createProviderError("import_confirmation_declined");
  }

  const cliSessionToken = await deps.getCliSessionToken(command.target);
  const masterPassword = await deps.promptSecret("Master password: ");
  const ciphertext = sealDeveloperSecretBlob(plaintext, masterPassword);

  await deps.writeRecord(cliSessionToken, command.target, ciphertext);
}

export async function runDevSecretsProvider(
  argv: string[],
  options: RunOptions = {},
) {
  const io: ProviderIo = options.io ?? {
    writeStdout(value) {
      stdout.write(value);
    },
    writeStderr(value) {
      stderr.write(value);
    },
  };
  const env = options.env ?? process.env;
  const deps: ProviderDeps = {
    ...createDefaultDeps(env),
    ...options.deps,
  };

  try {
    const command = parseProviderCommand(argv);

    if (command.kind === "read") {
      await runReadCommand(command, io, deps);
      return 0;
    }

    await runImportCommand(command, io, deps);
    return 0;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "provider_failed";
    if (message === "help") {
      io.writeStderr(`${DEV_SECRETS_PROVIDER_USAGE}\n`);
      return 0;
    }
    io.writeStderr(`${message}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runDevSecretsProvider(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
