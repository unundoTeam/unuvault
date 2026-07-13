import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const sourceRunner = resolve(
  repoRoot,
  "scripts/testing/run-with-shared-test-lock.sh",
);

type Harness = {
  binDirectory: string;
  commonDirectory: string;
  root: string;
  runner: string;
};

type RunnerResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
}

function makeHarness(commonDirectory?: string): Harness {
  const root = mkdtempSync(join(tmpdir(), "unuvault-test-lock-"));
  const scriptsDirectory = join(root, "scripts/testing");
  const binDirectory = join(root, "bin");
  const sharedCommonDirectory = commonDirectory ?? join(root, "git-common");
  const runner = join(scriptsDirectory, "run-with-shared-test-lock.sh");

  mkdirSync(scriptsDirectory, { recursive: true });
  mkdirSync(binDirectory, { recursive: true });
  mkdirSync(sharedCommonDirectory, { recursive: true });
  copyFileSync(sourceRunner, runner);
  writeExecutable(
    join(binDirectory, "git"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s\\n" "${UNUVAULT_TEST_GIT_COMMON_DIR:?}"',
      "",
    ].join("\n"),
  );

  return { binDirectory, commonDirectory: sharedCommonDirectory, root, runner };
}

function run(
  harness: Harness,
  command: string,
  extraEnvironment: NodeJS.ProcessEnv = {},
): RunnerResult {
  return spawnSync("bash", [harness.runner, command], {
    cwd: harness.root,
    encoding: "utf8",
    env: environment(harness, extraEnvironment),
  });
}

function start(
  harness: Harness,
  command: string,
): { child: ChildProcess; result: Promise<RunnerResult> } {
  const child = spawn("bash", [harness.runner, command], {
    cwd: harness.root,
    env: environment(harness),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return {
    child,
    result: new Promise((resolveResult, rejectResult) => {
      child.on("error", rejectResult);
      child.on("close", (status) => resolveResult({ status, stderr, stdout }));
    }),
  };
}

function environment(
  harness: Harness,
  extraEnvironment: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...extraEnvironment,
    PATH: `${harness.binDirectory}:${process.env.PATH ?? ""}`,
    UNUVAULT_TEST_GIT_COMMON_DIR: harness.commonDirectory,
  };
}

function writeCommand(harness: Harness, name: string, body: string): string {
  const path = join(harness.root, name);
  writeExecutable(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  return path;
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }

  throw new Error(`Timed out waiting for ${path}`);
}

async function settles(
  result: Promise<RunnerResult>,
  timeoutMilliseconds = 5_000,
): Promise<RunnerResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      result,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("runner did not settle")), timeoutMilliseconds);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

describe("shared test-runner lock", () => {
  it("serializes runners from worktrees that share a Git common directory with a hard-link owner token", async () => {
    const firstHarness = makeHarness();
    const secondHarness = makeHarness(firstHarness.commonDirectory);
    const releaseMarker = join(firstHarness.root, "release");
    const startedMarker = join(firstHarness.root, "started");
    const command = writeCommand(
      firstHarness,
      "blocking-command.sh",
      `: > ${JSON.stringify(startedMarker)}\nwhile [[ ! -e ${JSON.stringify(releaseMarker)} ]]; do sleep 0.01; done`,
    );
    const first = start(firstHarness, command);
    const lockPath = join(firstHarness.commonDirectory, ".unuvault-test-runner.lock");

    try {
      await waitForFile(startedMarker);
      const owner = readdirSync(firstHarness.commonDirectory).find((entry) =>
        entry.startsWith(".unuvault-test-runner.owner."),
      );

      expect(owner).toBeDefined();
      expect(statSync(lockPath).ino).toBe(
        statSync(join(firstHarness.commonDirectory, owner ?? "")).ino,
      );

      const blocked = run(secondHarness, "/usr/bin/true");
      expect(blocked.status).toBe(75);
      expect(blocked.stderr).toContain("reason=concurrent_runner");

      writeFileSync(releaseMarker, "release\n");
      expect((await settles(first.result)).status).toBe(0);
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      writeFileSync(releaseMarker, "release\n");
      first.child.kill("SIGKILL");
      await settles(first.result).catch(() => undefined);
      rmSync(firstHarness.root, { recursive: true, force: true });
      rmSync(secondHarness.root, { recursive: true, force: true });
    }
  });

  it("does not remove a lock it does not own", () => {
    const harness = makeHarness();
    const lockPath = join(harness.commonDirectory, ".unuvault-test-runner.lock");
    writeFileSync(lockPath, "another runner\n");

    try {
      const result = run(harness, "/usr/bin/true");
      expect(result.status).toBe(75);
      expect(readFileSync(lockPath, "utf8")).toBe("another runner\n");
    } finally {
      rmSync(harness.root, { recursive: true, force: true });
    }
  });

  it("retains the lock until a command process group drains", async () => {
    const harness = makeHarness();
    const releaseMarker = join(harness.root, "release-child");
    const startedMarker = join(harness.root, "child-started");
    const command = writeCommand(
      harness,
      "descendant-command.sh",
      `( while [[ ! -e ${JSON.stringify(releaseMarker)} ]]; do sleep 0.01; done ) &\n: > ${JSON.stringify(startedMarker)}`,
    );
    const running = start(harness, command);

    try {
      await waitForFile(startedMarker);
      expect(run(harness, "/usr/bin/true").status).toBe(75);

      writeFileSync(releaseMarker, "release\n");
      expect((await settles(running.result)).status).toBe(0);
    } finally {
      writeFileSync(releaseMarker, "release\n");
      running.child.kill("SIGKILL");
      await settles(running.result).catch(() => undefined);
      rmSync(harness.root, { recursive: true, force: true });
    }
  });

  it("aborts before starting the command when supervisor readiness fails", () => {
    const harness = makeHarness();
    const startedMarker = join(harness.root, "command-started");
    const command = writeCommand(harness, "start-marker.sh", `: > ${JSON.stringify(startedMarker)}`);
    writeExecutable(join(harness.binDirectory, "tr"), "#!/usr/bin/env bash\nexit 0\n");

    try {
      const result = run(harness, command);
      expect(result.status).toBe(74);
      expect(result.stderr).toContain("reason=process_group_unavailable");
      expect(existsSync(startedMarker)).toBe(false);
      expect(existsSync(join(harness.commonDirectory, ".unuvault-test-runner.lock"))).toBe(false);
    } finally {
      rmSync(harness.root, { recursive: true, force: true });
    }
  });
});
