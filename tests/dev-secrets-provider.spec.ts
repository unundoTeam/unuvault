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

describe("runDevSecretsProvider", () => {
  it("prints only dotenv to stdout on successful read", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const ciphertext = sealDeveloperSecretBlob(
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

  it("keeps stdout empty and reports decrypt_failed when read cannot decrypt", async () => {
    const { io, readStdout, readStderr } = createCapturedIo();
    const ciphertext = sealDeveloperSecretBlob(
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
