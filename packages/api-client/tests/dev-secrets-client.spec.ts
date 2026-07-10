import { describe, expect, it, vi } from "vitest";
import {
  createDevSecretsHandoff,
  exchangeDevSecretsHandoff,
  readDevSecretRecord,
  writeDevSecretRecord,
} from "../src/dev-secrets";
import { listSupportedDevSecretNamespaces } from "../src/dev-secrets-targets";

describe("dev secrets client", () => {
  it("lists only the retained unuidentity dotenv namespaces", () => {
    expect(listSupportedDevSecretNamespaces()).toEqual([
      "unuidentity/local/dotenv",
      "unuidentity/staging/dotenv",
      "unuidentity/production/dotenv",
    ]);
  });

  it("posts to /dev/secrets/handoffs with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        handoff_code: "handoff-code-1",
      }),
    });

    const response = await createDevSecretsHandoff(fetcher, "browser-jwt", {
      app: "unuidentity",
      env: "local",
    });

    expect(fetcher).toHaveBeenCalledWith("/dev/secrets/handoffs", {
      method: "POST",
      headers: {
        authorization: "Bearer browser-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        app: "unuidentity",
        env: "local",
      }),
    });
    expect(response.handoff_code).toBe("handoff-code-1");
  });

  it("posts to /dev/secrets/handoffs/exchange without bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cli_session_token: "cli-session-token",
      }),
    });

    const response = await exchangeDevSecretsHandoff(fetcher, "handoff-code-1");

    expect(fetcher).toHaveBeenCalledWith("/dev/secrets/handoffs/exchange", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        handoff_code: "handoff-code-1",
      }),
    });
    expect(response.cli_session_token).toBe("cli-session-token");
  });

  it("gets the private dotenv record with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ciphertext: "sealed-dotenv",
      }),
    });

    const response = await readDevSecretRecord(fetcher, "cli-session-token", {
      app: "unuidentity",
      env: "local",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/dev/secrets/records/unuidentity/local/dotenv",
      {
        method: "GET",
        headers: {
          authorization: "Bearer cli-session-token",
        },
      },
    );
    expect(response.ciphertext).toBe("sealed-dotenv");
  });

  it("puts ciphertext to the private dotenv record with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
      }),
    });

    const response = await writeDevSecretRecord(fetcher, "cli-session-token", {
      app: "unuidentity",
      env: "local",
      ciphertext: "sealed-dotenv",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/dev/secrets/records/unuidentity/local/dotenv",
      {
        method: "PUT",
        headers: {
          authorization: "Bearer cli-session-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ciphertext: "sealed-dotenv",
        }),
      },
    );
    expect(response.ok).toBe(true);
  });
});
