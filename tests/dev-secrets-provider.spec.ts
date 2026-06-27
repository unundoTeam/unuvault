import { createServer, type Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { sealDeveloperSecretBlob } from "../packages/security/src/developer-secret-envelope";
import { runDevSecretsProvider } from "../scripts/secrets/provider";

function createCapturedIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      writeStdout(value: string) {
        stdout.push(value);
      },
      writeStderr(value: string) {
        stderr.push(value);
      },
    },
    readStdout() {
      return stdout.join("");
    },
    readStderr() {
      return stderr.join("");
    },
  };
}

async function listenOnLocalhost(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test_server_bind_failed");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe("runDevSecretsProvider", () => {
  it("prints only dotenv to stdout on successful read", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const ciphertext = await sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\n",
      "correct horse",
    );
    const readRecord = vi.fn().mockResolvedValue({
      ciphertext,
    });

    const exitCode = await runDevSecretsProvider(
      ["read", "--app", "unundo", "--env", "local"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "correct horse",
          readRecord,
          writeRecord: async () => ({ ok: true as const }),
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(readRecord).toHaveBeenCalledWith("cli-session-token", {
      app: "unundo",
      env: "local",
    });
    expect(readStdout()).toBe("SUPABASE_URL=https://example.supabase.co\n");
    expect(readStderr()).toBe("");
  });

  it("verifies a stored dotenv record without releasing plaintext", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const plaintext = "SUPABASE_URL=https://example.supabase.co\n";
    const ciphertext = await sealDeveloperSecretBlob(
      plaintext,
      "correct horse",
    );
    const readRecord = vi.fn().mockResolvedValue({ ciphertext });
    const writeRecord = vi.fn().mockResolvedValue({ ok: true as const });

    const exitCode = await runDevSecretsProvider(
      ["verify", "--app", "unundo", "--env", "local"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "correct horse",
          readRecord,
          writeRecord,
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(readRecord).toHaveBeenCalledWith("cli-session-token", {
      app: "unundo",
      env: "local",
    });
    expect(writeRecord).not.toHaveBeenCalled();
    expect(readStdout()).toBe("VERIFY_OK unundo/local/dotenv\n");
    expect(readStdout()).not.toContain(plaintext);
    expect(readStderr()).toBe("");
  });

  it("checks the local browser handoff runtime before opening login", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const apiServer = createServer((_request, response) => {
      response.statusCode = 503;
      response.end("api unavailable");
    });
    const webServer = createServer((_request, response) => {
      response.statusCode = 200;
      response.end("web ready");
    });

    const apiBaseUrl = await listenOnLocalhost(apiServer);
    const webBaseUrl = await listenOnLocalhost(webServer);

    try {
      const exitCode = await runDevSecretsProvider(
        ["verify", "--app", "unuidentity", "--env", "local"],
        {
          io,
          env: {
            ...process.env,
            UNUVAULT_API_BASE_URL: apiBaseUrl,
            UNUVAULT_WEB_BASE_URL: webBaseUrl,
          },
        },
      );

      expect(exitCode).toBe(1);
      expect(readStdout()).toBe("");
      expect(readStderr()).toContain("browser_handoff_runtime_unavailable");
      expect(readStderr()).toContain("corepack pnpm dev:api");
      expect(readStderr()).toContain("corepack pnpm dev:web");
      expect(readStderr()).not.toContain("Opening browser for unuvault login");
    } finally {
      await closeServer(apiServer);
      await closeServer(webServer);
    }
  });

  it("accepts unuidentity/production as a supported read target", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const ciphertext = await sealDeveloperSecretBlob(
      "IDENTITY_SUPABASE_URL=https://identity.example.supabase.co\n",
      "correct horse",
    );
    const readRecord = vi.fn().mockResolvedValue({
      ciphertext,
    });

    const exitCode = await runDevSecretsProvider(
      ["read", "--app", "unuidentity", "--env", "production"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "correct horse",
          readRecord,
          writeRecord: async () => ({ ok: true as const }),
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(readRecord).toHaveBeenCalledWith("cli-session-token", {
      app: "unuidentity",
      env: "production",
    });
    expect(readStdout()).toBe(
      "IDENTITY_SUPABASE_URL=https://identity.example.supabase.co\n",
    );
    expect(readStderr()).toBe("");
  });

  it("keeps stdout empty for unsupported namespaces", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();

    const exitCode = await runDevSecretsProvider(
      ["read", "--app", "unknown-app", "--env", "staging"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "correct horse",
          readRecord: async () => ({
            ciphertext: "",
          }),
          writeRecord: async () => ({ ok: true as const }),
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(readStdout()).toBe("");
    expect(readStderr()).toContain("invalid_target");
  });

  it("keeps stdout empty and reports decrypt_failed when read cannot decrypt", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const ciphertext = await sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\n",
      "correct horse",
    );

    const exitCode = await runDevSecretsProvider(
      ["read", "--app", "unundo", "--env", "local"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "wrong horse",
          readRecord: async () => ({
            ciphertext,
          }),
          writeRecord: async () => ({ ok: true as const }),
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(readStdout()).toBe("");
    expect(readStderr()).toContain("decrypt_failed");
    expect(readStderr()).not.toContain("SUPABASE_URL=");
  });

  it("keeps stdout empty when verify cannot decrypt", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const plaintext = "SUPABASE_URL=https://example.supabase.co\n";
    const ciphertext = await sealDeveloperSecretBlob(
      plaintext,
      "correct horse",
    );
    const writeRecord = vi.fn().mockResolvedValue({ ok: true as const });

    const exitCode = await runDevSecretsProvider(
      ["verify", "--app", "unundo", "--env", "local"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "wrong horse",
          readRecord: async () => ({ ciphertext }),
          writeRecord,
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(writeRecord).not.toHaveBeenCalled();
    expect(readStdout()).toBe("");
    expect(readStderr()).toContain("decrypt_failed");
    expect(readStderr()).not.toContain(plaintext);
  });

  it("keeps stdout empty and reports decrypt_failed for malformed ciphertext", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();

    const exitCode = await runDevSecretsProvider(
      ["read", "--app", "unundo", "--env", "local"],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "correct horse",
          readRecord: async () => ({
            ciphertext: "not-json",
          }),
          writeRecord: async () => ({ ok: true as const }),
          readTextFile: async () => "",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(readStdout()).toBe("");
    expect(readStderr()).toContain("decrypt_failed");
  });

  it("prints a safe import summary before uploading ciphertext", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const writeRecord = vi.fn().mockResolvedValue({
      ok: true as const,
    });

    const exitCode = await runDevSecretsProvider(
      [
        "import",
        "--app",
        "unundo",
        "--env",
        "local",
        "--from",
        "/tmp/local.env",
      ],
      {
        io,
        deps: {
          getCliSessionToken: async () => "cli-session-token",
          promptSecret: async () => "correct horse",
          readRecord: async () => ({
            ciphertext: "",
          }),
          writeRecord,
          readTextFile: async () =>
            "SUPABASE_URL=https://example.supabase.co\nSUPABASE_KEY=test-key\n",
          confirm: async () => true,
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(writeRecord).toHaveBeenCalledWith(
      "cli-session-token",
      {
        app: "unundo",
        env: "local",
      },
      expect.any(String),
    );
    expect(readStdout()).toBe("");
    expect(readStderr()).toContain("Target: unundo/local/dotenv");
    expect(readStderr()).toContain("Source: /tmp/local.env");
    expect(readStderr()).toContain("SHA256:");
    expect(readStderr()).not.toContain("test-key");
  });
});
