// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  syncVault: vi.fn(),
}));

const storedPassword = (password: string, passphrase?: string): string =>
  sealVaultPassword(password, passphrase);

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

vi.mock("../src/lib/identity/browser", () => ({
  createIdentityBrowserClient: () => ({
    auth: {
      getSession: mocks.getSession,
    },
  }),
}));

vi.mock("../../../packages/api-client/src/vault", () => ({
  syncVault: mocks.syncVault,
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenCalledWith(expect.any(Function), "jwt-token", {
      changed_items: [],
      deleted_item_ids: [],
    });
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

    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock vault" })).toBeInTheDocument();
  });

  it("shows locked mode when a stored master password verifier already exists", async () => {
    window.localStorage.setItem(
      "unuvault.web.master-password-verifier",
      JSON.stringify(createMasterPasswordVerifier("correct horse")),
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
      JSON.stringify(createMasterPasswordVerifier("correct horse")),
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
            password_ciphertext: storedPassword("hunter2"),
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
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

    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
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
      },
    );

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

    await screen.findByText("GitHub");

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
              password_ciphertext: storedPassword("hunter2", "correct horse"),
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
    await unlockVault("correct horse");

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

    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
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
      },
    );

    const createPayload = mocks.syncVault.mock.calls[1]?.[2].changed_items[0]
      .encrypted_payload;

    expect(createPayload.password_ciphertext).not.toBe("hunter2");
    expect(JSON.parse(createPayload.password_ciphertext)).toMatchObject({
      version: 2,
      cipher: "xor-stream-v1",
      keyDerivation: "unlock-passphrase-v1",
      unlockSalt: expect.any(String),
      unlockTag: expect.any(String),
      encryptedPayload: expect.any(String),
    });
    expect(
      openStoredVaultPassword(createPayload.password_ciphertext, "correct horse"),
    ).toBe("hunter2");
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
              password_ciphertext: storedPassword("hunter2", "correct horse"),
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
    await unlockVault("correct horse");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter2" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitHub" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    await screen.findByText("GitHub");

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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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

    expect(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    ).toBeDisabled();

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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
      JSON.stringify(createMasterPasswordVerifier("correct horse")),
    );

    render(<VaultPage />);

    await unlockVault("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Copy password GitHub" }));

    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("hunter2");
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
      JSON.stringify(createMasterPasswordVerifier("correct horse")),
    );

    render(<VaultPage />);

    await unlockVault("wrong battery");
    expect(screen.getByRole("button", { name: "Copy password GitHub" })).toBeDisabled();

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
    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();

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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
            password_ciphertext: storedPassword("linear-secret", "battery staple"),
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

    expect(
      await screen.findByText("Master password must unlock existing saved passwords"),
    ).toBeInTheDocument();
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "GitLab" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Saving item...")).toBeInTheDocument();

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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete GitHub" }));

    expect(
      await screen.findByText("We couldn't sync your vault. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
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

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
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

    expect(await screen.findByText("No password saved")).toBeInTheDocument();
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
            password_ciphertext: storedPassword("hunter2"),
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

    expect(await screen.findByText("••••••••")).toBeInTheDocument();
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
            password_ciphertext: storedPassword("hunter2"),
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    );

    expect(writeText).toHaveBeenCalledWith("hunter2");
    expect(screen.getByText("••••••••")).toBeInTheDocument();
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

    await unlockVault("correct horse");
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    );

    expect(writeText).toHaveBeenCalledWith("hunter2");
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
            password_ciphertext: storedPassword("linear-secret", "correct horse"),
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Copy password GitHub" }),
    );

    expect(writeText).toHaveBeenCalledWith("hunter2");
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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

    const copyButton = await screen.findByRole("button", {
      name: "Copy password GitHub",
    });

    await unlockVault("correct horse");
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Copied password GitHub" })).toBeInTheDocument();
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole("button", { name: "Copy password GitHub" })).toBeInTheDocument();
    expect(screen.getByText("••••••••")).toBeInTheDocument();
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
            password_ciphertext: storedPassword("linear-secret", "correct horse"),
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Show password GitHub" }),
    );

    expect(await screen.findByText("hunter2")).toBeInTheDocument();
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Show password GitHub" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide password GitHub" }));

    expect(await screen.findByText("••••••••")).toBeInTheDocument();
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(screen.getByDisplayValue("GitHub")).toBeInTheDocument();
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(screen.getByDisplayValue("GitHub")).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Personal account")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://github.com/login")).toBeInTheDocument();
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
            password_ciphertext: storedPassword("hunter2", "correct horse"),
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    await unlockVault("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(screen.getByLabelText("Edit password")).toHaveValue("hunter2");
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(screen.getByDisplayValue("GitHub"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("GitHub Personal")).toBeInTheDocument();
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(screen.getByDisplayValue("GitHub"), {
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(screen.getByDisplayValue("GitHub"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.change(screen.getByDisplayValue("alice@example.com"), {
      target: { value: "alice@work.com" },
    });
    fireEvent.change(screen.getByDisplayValue("https://github.com/login"), {
      target: { value: "app.github.com" },
    });
    fireEvent.change(screen.getByDisplayValue("Personal account"), {
      target: { value: "Work account" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
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
      },
    );
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
              password_ciphertext: storedPassword("hunter2", "correct horse"),
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
              password_ciphertext: storedPassword("work-secret", "correct horse"),
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    await unlockVault("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(screen.getByLabelText("Edit password"), {
      target: { value: "work-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mocks.syncVault).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "jwt-token",
      {
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
      },
    );

    const updatePayload = mocks.syncVault.mock.calls[1]?.[2].changed_items[0]
      .encrypted_payload;

    expect(updatePayload.password_ciphertext).not.toBe("work-secret");
    expect(JSON.parse(updatePayload.password_ciphertext)).toMatchObject({
      version: 2,
      cipher: "xor-stream-v1",
      keyDerivation: "unlock-passphrase-v1",
      unlockSalt: expect.any(String),
      unlockTag: expect.any(String),
      encryptedPayload: expect.any(String),
    });
    expect(
      openStoredVaultPassword(updatePayload.password_ciphertext, "correct horse"),
    ).toBe("work-secret");
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
              password_ciphertext: storedPassword("hunter2"),
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    await unlockVault("correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    expect(screen.getByLabelText("Edit password")).toHaveValue("hunter2");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const updatePayload = mocks.syncVault.mock.calls[1]?.[2].changed_items[0]
      .encrypted_payload;

    expect(updatePayload.password_ciphertext).not.toBe("hunter2");
    expect(JSON.parse(updatePayload.password_ciphertext)).toMatchObject({
      version: 2,
      cipher: "xor-stream-v1",
      keyDerivation: "unlock-passphrase-v1",
      unlockSalt: expect.any(String),
      unlockTag: expect.any(String),
      encryptedPayload: expect.any(String),
    });
    expect(
      openStoredVaultPassword(updatePayload.password_ciphertext, "correct horse"),
    ).toBe("hunter2");
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(screen.getByDisplayValue("GitHub"), {
      target: { value: "GitHub Personal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("GitHub")).toBeInTheDocument();
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));
    fireEvent.change(screen.getByDisplayValue("GitHub"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Edited title is required.")).toBeInTheDocument();
    expect(mocks.syncVault).toHaveBeenCalledTimes(1);
  });
});
