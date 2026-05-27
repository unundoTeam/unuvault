// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VaultPage from "../src/app/vault/page";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import {
  openStoredVaultPassword,
  sealVaultPassword,
} from "../../../packages/security/src/vault-envelope";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  mocks.getSession.mockReset();
  mocks.syncVault.mockReset();
  mocks.publishLocalCredentialBridgeSession.mockReset();
  mocks.clearLocalCredentialBridgeSession.mockReset();
});

const {
  clearLocalCredentialBridgeSession,
  getSession,
  publishLocalCredentialBridgeSession,
  syncVault,
} = vi.hoisted(() => ({
  clearLocalCredentialBridgeSession: vi.fn().mockResolvedValue({ ok: true }),
  getSession: vi.fn(),
  publishLocalCredentialBridgeSession: vi.fn().mockResolvedValue({
    ok: true,
    credential_count: 1,
  }),
  syncVault: vi.fn(),
}));

const mocks = {
  clearLocalCredentialBridgeSession,
  getSession,
  publishLocalCredentialBridgeSession,
  syncVault,
};

beforeEach(() => {
  mocks.clearLocalCredentialBridgeSession.mockResolvedValue({ ok: true });
  mocks.publishLocalCredentialBridgeSession.mockResolvedValue({
    ok: true,
    credential_count: 1,
  });
});

function createLegacyVaultEnvelope(password: string): string {
  return JSON.stringify({
    version: 1,
    cipher: "xchacha20-poly1305",
    encryptedPayload: password,
    keyDerivation: "argon2id",
  } as const);
}

const storedPassword = async (
  password: string,
  passphrase?: string,
): Promise<string> =>
  passphrase
    ? await sealVaultPassword(password, passphrase)
    : createLegacyVaultEnvelope(password);

async function setMasterPassword(
  password: string,
  confirmation: string = password,
) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm master password"), {
    target: { value: confirmation },
  });

  fireEvent.click(screen.getByRole("button", { name: "Set master password" }));
}

async function unlockWithMasterPassword(password: string) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: password },
  });

  fireEvent.click(screen.getByRole("button", { name: "Unlock vault" }));
}

async function unlockVault(passphrase: string) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: passphrase },
  });

  const confirmation = screen.queryByLabelText("Confirm master password");

  if (confirmation) {
    fireEvent.change(confirmation, {
      target: { value: passphrase },
    });
  }

  fireEvent.click(screen.getByRole("button", { name: /Set master password|Unlock vault/ }));
}

async function expectVaultUnlocked() {
  expect(
    await screen.findByText("Vault unlocked", undefined, { timeout: 5000 }),
  ).toBeInTheDocument();
}

async function unlockVaultSuccessfully(passphrase: string) {
  await unlockVault(passphrase);
  await expectVaultUnlocked();
}

async function unlockAndOpenCreatePanel(passphrase: string = "correct horse") {
  await unlockVaultSuccessfully(passphrase);
  const newLoginButton = screen.queryByRole("button", { name: "New login" });

  if (newLoginButton) {
    fireEvent.click(newLoginButton);
  }

  await screen.findByRole("form", { name: "Save vault item" });
}

async function expectVisibleText(text: string) {
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
}

function expectVisibleTextNow(text: string) {
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
}

async function expectSyncCall(callIndex: number, expectedPayload: unknown) {
  await waitFor(() => {
    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      callIndex,
      expect.any(Function),
      "jwt-token",
      expectedPayload,
    );
  });
}

async function expectVaultMutation(callIndex: number) {
  await waitFor(() => {
    expect(mocks.syncVault).toHaveBeenCalledTimes(callIndex);
  });

  return mocks.syncVault.mock.calls[callIndex - 1]?.[2];
}

vi.mock("../src/lib/identity/browser", () => ({
  createIdentityBrowserClient: () => ({
    auth: {
      getSession,
    },
  }),
}));

vi.mock("../../../packages/api-client/src/vault", () => ({
  syncVault,
}));

vi.mock("../src/lib/local-credential-bridge/bridge-session", () => ({
  clearLocalCredentialBridgeSession,
  publishLocalCredentialBridgeSession,
}));

describe("VaultPage", () => {
  it("shows sign-in guidance when there is no active session", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    render(<VaultPage />);

    expect(
      await screen.findByText("Sign in from the register flow first."),
    ).toBeInTheDocument();
    expect(mocks.syncVault).not.toHaveBeenCalled();
  });

  it("keeps the vault in pre-bootstrap guidance when the local profile is missing", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockRejectedValue(new Error("profile_not_found"));

    render(<VaultPage />);

    expect(
      await screen.findByText("Sign in from the register flow first."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("We couldn't sync your vault. Please try again."),
    ).not.toBeInTheDocument();
  });

  it("loads vault items on first render for an authenticated session", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    expect(mocks.syncVault).toHaveBeenCalledWith(expect.any(Function), "jwt-token", {
      changed_items: [],
      deleted_item_ids: [],
    });
  });

  it("shows the Mac companion as the local-first fill authority", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-05-27T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("Mac companion")).toBeInTheDocument();
    expect(
      screen.getByText("Local fill requests require the unlocked Mac companion."),
    ).toBeInTheDocument();
  });

  it("shows sync status and last synced time after initial load", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });

    let resolveSync!: (value: {
      server_time: string;
      updated_items: never[];
      deleted_item_ids: never[];
      conflicts: never[];
    }) => void;

    mocks.syncVault.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );

    render(<VaultPage />);

    expect(await screen.findByText("Syncing vault...")).toBeInTheDocument();

    resolveSync({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    expect(await screen.findByText("Vault synced")).toBeInTheDocument();
    expect(await screen.findByText("Last synced at 00:00 UTC")).toBeInTheDocument();
  });

  it("shows setup mode when no master password verifier is stored", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm master password")).toBeInTheDocument();
  });

  it("unlocks immediately after setting the first master password", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await setMasterPassword("correct horse");

    await expectVaultUnlocked();
    expect(screen.getByRole("button", { name: "Lock vault" })).toBeInTheDocument();
  });

  it("publishes and clears the local credential bridge session with the web unlock state", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          item_type: "login",
          title: "Developer console client A",
          encrypted_payload: {
            schema_version: 1,
            username: "client-a@example.com",
            password_ciphertext: await storedPassword(
              "client-a-password",
              "correct horse",
            ),
            notes: "",
            website_url: "https://console.example.com/login",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-04-29T00:00:00.000Z",
          updated_at: "2026-04-29T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("Developer console client A")).toBeInTheDocument();
    await unlockVaultSuccessfully("correct horse");

    await waitFor(() => {
      expect(mocks.publishLocalCredentialBridgeSession).toHaveBeenCalledWith({
        accessToken: "jwt-token",
        items: [
          expect.objectContaining({
            id: "550e8400-e29b-41d4-a716-446655440000",
          }),
        ],
        unlockPassphrase: "correct horse",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Lock vault" }));

    await waitFor(() => {
      expect(mocks.clearLocalCredentialBridgeSession).toHaveBeenCalledWith({
        accessToken: "jwt-token",
      });
    });
  });

  it("shows locked mode when a stored master password verifier already exists", async () => {
    window.localStorage.setItem(
      "unuvault.web.master-password-verifier",
      JSON.stringify(await createMasterPasswordVerifier("correct horse")),
    );

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set master password" })).not.toBeInTheDocument();
  });

  it("shows an error for a wrong master password", async () => {
    window.localStorage.setItem(
      "unuvault.web.master-password-verifier",
      JSON.stringify(await createMasterPasswordVerifier("correct horse")),
    );

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockWithMasterPassword("wrong battery");

    expect(await screen.findByText("Wrong master password")).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("requires setup before unlocking saved passwords when no verifier exists yet", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    expect(screen.getByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlock vault" })).not.toBeInTheDocument();
  });

  it("prompts to set a master password when no verifier exists yet", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm master password")).toBeInTheDocument();
  });

  it("creates a vault item from the title form", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:01.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:01.000Z",
            updated_at: "2026-03-16T00:00:01.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockAndOpenCreatePanel();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await expectVisibleText("GitHub");
    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
        changed_items: [
          expect.objectContaining({
            item_type: "login",
            title: "GitHub",
            favorite: false,
            source: "manual",
          }),
        ],
        deleted_item_ids: [],
      },
    );

  });

  it("shows create success feedback after saving a new item", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:01:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:01:00.000Z",
            updated_at: "2026-03-16T00:01:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    expect(await screen.findByText("Vault synced")).toBeInTheDocument();
    await unlockAndOpenCreatePanel();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    expect(await screen.findByText("Item saved")).toBeInTheDocument();
    expect(await screen.findByText("Last synced at 00:01 UTC")).toBeInTheDocument();
  });

  it("creates a login item with username and notes", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:01:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: "",
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:01:00.000Z",
            updated_at: "2026-03-16T00:01:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockAndOpenCreatePanel();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Personal account" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await expectSyncCall(2, {
      changed_items: [
        expect.objectContaining({
          title: "GitHub",
          encrypted_payload: expect.objectContaining({
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "Personal account",
          }),
        }),
      ],
      deleted_item_ids: [],
    });

  });

  it("resets the create form after saving a login item", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:01:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: "",
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:01:00.000Z",
            updated_at: "2026-03-16T00:01:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockAndOpenCreatePanel();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Personal account" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await expectVisibleText("GitHub");

    fireEvent.click(screen.getByRole("button", { name: "New login" }));

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
  });

  it("creates a login item with a password value", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:01:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: await storedPassword("hunter2", "correct horse"),
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:01:00.000Z",
            updated_at: "2026-03-16T00:01:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "New login" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Website"), {
      target: { value: "github.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter2" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Personal account" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await expectSyncCall(2, {
      changed_items: [
        expect.objectContaining({
          title: "GitHub",
          encrypted_payload: expect.objectContaining({
            schema_version: 1,
            username: "alice@example.com",
            notes: "Personal account",
            website_url: "https://github.com/",
          }),
        }),
      ],
      deleted_item_ids: [],
    });

    const createMutation = await expectVaultMutation(2);
    const createPayload = createMutation.changed_items[0].encrypted_payload;

    expect(createPayload.password_ciphertext).not.toBe("hunter2");
    expect(JSON.parse(createPayload.password_ciphertext)).toMatchObject({
      version: 3,
      cipher: "xchacha20poly1305-ietf",
      keyDerivation: "argon2id13",
      purpose: "vault-password",
      nonce: expect.any(String),
      salt: expect.any(String),
      opsLimit: expect.any(Number),
      memLimit: expect.any(Number),
      encryptedPayload: expect.any(String),
    });
    await expect(
      openStoredVaultPassword(createPayload.password_ciphertext, "correct horse"),
    ).resolves.toBe("hunter2");
  });

  it("resets the create password field and hides it after save", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:01:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
              password_ciphertext: await storedPassword("hunter2", "correct horse"),
              notes: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:01:00.000Z",
            updated_at: "2026-03-16T00:01:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "New login" }));

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter2" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await expectVisibleText("GitHub");

    fireEvent.click(screen.getByRole("button", { name: "New login" }));

    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("blocks blank titles before sending sync", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockAndOpenCreatePanel();

    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    expect(await screen.findByText("Title is required.")).toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenCalledTimes(1);
  });

  it("blocks save when the website URL is invalid", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    await unlockAndOpenCreatePanel();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.change(screen.getByLabelText("Website"), {
      target: { value: "not a url" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    expect(await screen.findByText("Enter a valid website URL.")).toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenCalledTimes(1);
  });

  it("deletes a vault item through deleted_item_ids", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:01.000Z",
        updated_items: [],
        deleted_item_ids: ["item-1"],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Delete GitHub" }));

    expect(await screen.findByText("No vault items yet.")).toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
        changed_items: [],
        deleted_item_ids: ["item-1"],
      },
    );
  });

  it("shows delete success feedback after deleting an item", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:02:00.000Z",
        updated_items: [],
        deleted_item_ids: ["item-1"],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Delete GitHub" }));

    expect(await screen.findByText("Item deleted")).toBeInTheDocument();
    expect(await screen.findByText("Last synced at 00:02 UTC")).toBeInTheDocument();
  });

  it("blocks copying a passphrase-protected password while the vault is locked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByRole("button", { name: "Locked GitHub" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Copy password GitHub" }),
    ).not.toBeInTheDocument();

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Set master password" })).toBeInTheDocument();
  });

  it("unlocks the vault with the correct passphrase before copying a saved password", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    window.localStorage.setItem(
      "unuvault.web.master-password-verifier",
      JSON.stringify(await createMasterPasswordVerifier("correct horse")),
    );

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Copy password GitHub" }));

    await expectVaultUnlocked();
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hunter2");
    });
  });

  it("shows an error and stays locked when the master password is wrong", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    window.localStorage.setItem(
      "unuvault.web.master-password-verifier",
      JSON.stringify(await createMasterPasswordVerifier("correct horse")),
    );

    render(<VaultPage />);

    await unlockVault("wrong battery");
    expect(screen.getByRole("button", { name: "Locked GitHub" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Copy password GitHub" }),
    ).not.toBeInTheDocument();

    expect(await screen.findByText("Wrong master password")).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("returns to locked mode after remount when a verifier exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    const firstRender = render(<VaultPage />);

    await setMasterPassword("correct horse");
    await expectVaultUnlocked();

    firstRender.unmount();
    render(<VaultPage />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("requires the master password to open every protected password during setup", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "item-2",
          item_type: "login",
          title: "Linear",
          encrypted_payload: {
            schema_version: 1,
            username: "bob@example.com",
            password_ciphertext: await storedPassword("linear-secret", "battery staple"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVault("correct horse");
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("keeps the current vault list visible while a mutation sync is pending", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });

    let resolveMutation!: (value: {
      server_time: string;
      updated_items: {
        id: string;
        item_type: "login";
        title: string;
        encrypted_payload: {
          schema_version: number;
          username: string;
        };
        favorite: false;
        source: "manual";
        last_used_at: null;
        created_at: string;
        updated_at: string;
      }[];
      deleted_item_ids: never[];
      conflicts: never[];
    }) => void;

    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveMutation = resolve;
        }),
      );

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockAndOpenCreatePanel();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitLab" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await waitFor(() => {
      expectVisibleTextNow("GitHub");
      expect(screen.getByText("Saving item...")).toBeInTheDocument();
    });

    resolveMutation({
      server_time: "2026-03-16T00:01:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "item-2",
          item_type: "login",
          title: "GitLab",
          encrypted_payload: {
            schema_version: 1,
            username: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:01:00.000Z",
          updated_at: "2026-03-16T00:01:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });
  });

  it("preserves the last successful list when sync fails", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockRejectedValueOnce(new Error("sync failed"));

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Delete GitHub" }));

    expect(
      await screen.findByText("We couldn't sync your vault. Please try again."),
    ).toBeInTheDocument();
    expectVisibleTextNow("GitHub");
  });

  it("shows username in the vault list", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    await expectVisibleText("alice@example.com");
  });

  it("shows a notes indicator when notes exist", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "Personal account",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("Notes added")).toBeInTheDocument();
  });

  it("shows no password saved when password_ciphertext is empty", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    await expectVisibleText("No password saved");
    expect(
      screen.queryByRole("button", { name: "Show password GitHub" }),
    ).not.toBeInTheDocument();
  });

  it("shows a masked password placeholder and reveal action when password exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    await expectVisibleText("••••••••");
    expect(
      screen.getByRole("button", { name: "Show password GitHub" }),
    ).toBeInTheDocument();
  });

  it("shows copy username only when a username exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "item-2",
          item_type: "login",
          title: "Linear",
          encrypted_payload: {
            schema_version: 1,
            username: "",
            password_ciphertext: "",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    expect(
      await screen.findByRole("button", { name: "Copy username GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy username Linear" }),
    ).not.toBeInTheDocument();
  });

  it("copies the username and shows copied feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy username GitHub" }),
    );

    expect(writeText).toHaveBeenCalledWith("alice@example.com");
    expect(
      await screen.findByRole("button", { name: "Copied GitHub" }),
    ).toBeInTheDocument();
  });

  it("shows copy password only when a saved password exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "item-2",
          item_type: "login",
          title: "Linear",
          encrypted_payload: {
            schema_version: 1,
            username: "bob@example.com",
            password_ciphertext: "",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    expect(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy password Linear" }),
    ).not.toBeInTheDocument();
  });

  it("copies the saved password after unlock without requiring reveal first", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hunter2");
    });
    expectVisibleTextNow("••••••••");
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument();
  });

  it("copies a legacy plaintext password after unlock without requiring reveal first", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "hunter2",
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hunter2");
    });
  });

  it("shows copied password feedback only for the targeted item", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "item-2",
          item_type: "login",
          title: "Linear",
          encrypted_payload: {
            schema_version: 1,
            username: "bob@example.com",
            password_ciphertext: await storedPassword("linear-secret", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hunter2");
    });
    expect(
      await screen.findByRole("button", { name: "Copied password GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copied password Linear" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy password Linear" }),
    ).toBeInTheDocument();
  });

  it("clears copied password feedback after the timeout without revealing the password", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    const copyButton = await screen.findByRole("button", {
      name: "Copy password GitHub",
    });

    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Copied password GitHub" })).toBeInTheDocument();
    expectVisibleTextNow("••••••••");
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole("button", { name: "Copy password GitHub" })).toBeInTheDocument();
    expectVisibleTextNow("••••••••");
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument();
  });

  it("reveals only the targeted item's saved password value", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
        {
          id: "item-2",
          item_type: "login",
          title: "Linear",
          encrypted_payload: {
            schema_version: 1,
            username: "bob@example.com",
            password_ciphertext: await storedPassword("linear-secret", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Show password GitHub" }),
    );

    await expectVisibleText("hunter2");
    expect(screen.queryByText("linear-secret")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide password GitHub" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show password Linear" }),
    ).toBeInTheDocument();
  });

  it("hides the placeholder again when Hide password is clicked", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Show password GitHub" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Hide password GitHub" }));

    await waitFor(() => {
      expect(screen.queryByText("hunter2")).not.toBeInTheDocument();
    });
    await expectVisibleText("••••••••");
    expect(
      screen.getByRole("button", { name: "Show password GitHub" }),
    ).toBeInTheDocument();
  });

  it("enters inline edit mode for one vault item", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(await screen.findByLabelText("Edit title")).toHaveValue("GitHub");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("prefills title, username, notes, and website in edit mode", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: "",
            notes: "Personal account",
            website_url: "https://github.com/login",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(await screen.findByLabelText("Edit title")).toHaveValue("GitHub");
    expect(screen.getByLabelText("Edit username")).toHaveValue("alice@example.com");
    expect(screen.getByLabelText("Edit notes")).toHaveValue("Personal account");
    expect(screen.getByLabelText("Edit website")).toHaveValue("https://github.com/login");
  });

  it("prefills password in edit mode and keeps it hidden by default", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice@example.com",
            password_ciphertext: await storedPassword("hunter2", "correct horse"),
            notes: "Personal account",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(await screen.findByLabelText("Edit password")).toHaveValue("hunter2");
    expect(screen.getByLabelText("Edit password")).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show edit password" }));

    expect(screen.getByLabelText("Edit password")).toHaveAttribute("type", "text");
  });

  it("saves an edited title through changed_items", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:01.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub Personal",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:01.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(await screen.findByLabelText("Edit title"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await expectVisibleText("GitHub Personal");
    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
        changed_items: [
          expect.objectContaining({
            id: "item-1",
            title: "GitHub Personal",
          }),
        ],
        deleted_item_ids: [],
      },
    );

  });

  it("shows update success feedback after editing an item", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:03:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub Personal",
            encrypted_payload: {
              schema_version: 1,
              username: "",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:03:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(await screen.findByLabelText("Edit title"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Item updated")).toBeInTheDocument();
    expect(await screen.findByText("Last synced at 00:03 UTC")).toBeInTheDocument();
  });

  it("saves edited username, notes, and website through changed_items", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: "",
              notes: "Personal account",
              website_url: "https://github.com/login",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:03:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub Personal",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@work.com",
              password_ciphertext: "",
              notes: "Work account",
              website_url: "https://app.github.com/",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:03:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(await screen.findByLabelText("Edit title"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.change(screen.getByLabelText("Edit username"), {
      target: { value: "alice@work.com" },
    });
    fireEvent.change(screen.getByLabelText("Edit website"), {
      target: { value: "app.github.com" },
    });
    fireEvent.change(screen.getByLabelText("Edit notes"), {
      target: { value: "Work account" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await expectSyncCall(2, {
      changed_items: [
        expect.objectContaining({
          id: "item-1",
          title: "GitHub Personal",
          encrypted_payload: expect.objectContaining({
            username: "alice@work.com",
            notes: "Work account",
            password_ciphertext: "",
            website_url: "https://app.github.com/",
          }),
        }),
      ],
      deleted_item_ids: [],
    });
  });

  it("saves an edited password through changed_items", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: await storedPassword("hunter2", "correct horse"),
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:03:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: await storedPassword("work-secret", "correct horse"),
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:03:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(await screen.findByLabelText("Edit password"), {
      target: { value: "work-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await expectSyncCall(2, {
      changed_items: [
        expect.objectContaining({
          id: "item-1",
          encrypted_payload: expect.objectContaining({
            username: "alice@example.com",
            notes: "Personal account",
          }),
        }),
      ],
      deleted_item_ids: [],
    });

    const updateMutation = await expectVaultMutation(2);
    const updatePayload = updateMutation.changed_items[0].encrypted_payload;

    expect(updatePayload.password_ciphertext).not.toBe("work-secret");
    expect(JSON.parse(updatePayload.password_ciphertext)).toMatchObject({
      version: 3,
      cipher: "xchacha20poly1305-ietf",
      keyDerivation: "argon2id13",
      purpose: "vault-password",
      nonce: expect.any(String),
      salt: expect.any(String),
      opsLimit: expect.any(Number),
      memLimit: expect.any(Number),
      encryptedPayload: expect.any(String),
    });
    await expect(
      openStoredVaultPassword(updatePayload.password_ciphertext, "correct horse"),
    ).resolves.toBe("work-secret");
  });

  it("reseals a legacy plaintext password when the item is saved", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: "hunter2",
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      })
      .mockResolvedValueOnce({
        server_time: "2026-03-16T00:03:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice@example.com",
              password_ciphertext: await storedPassword("hunter2"),
              notes: "Personal account",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:03:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      });

    render(<VaultPage />);

    await expectVisibleText("GitHub");

    await unlockVaultSuccessfully("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    expect(await screen.findByLabelText("Edit password")).toHaveValue("hunter2");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const updateMutation = await expectVaultMutation(2);
    const updatePayload = updateMutation.changed_items[0].encrypted_payload;

    expect(updatePayload.password_ciphertext).not.toBe("hunter2");
    expect(JSON.parse(updatePayload.password_ciphertext)).toMatchObject({
      version: 3,
      cipher: "xchacha20poly1305-ietf",
      keyDerivation: "argon2id13",
      purpose: "vault-password",
      nonce: expect.any(String),
      salt: expect.any(String),
      opsLimit: expect.any(Number),
      memLimit: expect.any(Number),
      encryptedPayload: expect.any(String),
    });
    await expect(
      openStoredVaultPassword(updatePayload.password_ciphertext, "correct horse"),
    ).resolves.toBe("hunter2");
  });

  it("cancels inline edit mode without sending sync", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(await screen.findByLabelText("Edit title"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expectVisibleTextNow("GitHub");
    expect(screen.queryByDisplayValue("GitHub Personal")).not.toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenCalledTimes(1);
  });

  it("blocks empty edited titles before sending sync", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-03-16T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await expectVisibleText("GitHub");
    await unlockVaultSuccessfully("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(await screen.findByLabelText("Edit title"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Edited title is required.")).toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenCalledTimes(1);
  });
});
