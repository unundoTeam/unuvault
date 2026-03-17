// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSyncItem } from "../../../packages/api-client/src/vault";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import { App } from "../src/popup/App";

const MASTER_PASSWORD_VERIFIER_STORAGE_KEY =
  "unuvault.extension.master-password-verifier";
const POPUP_VAULT_STORAGE_KEY = "unuvault.extension.popup-vault-items";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function createVaultItem(overrides?: Partial<VaultSyncItem>): VaultSyncItem {
  return {
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
    created_at: "2026-03-17T00:00:00.000Z",
    updated_at: "2026-03-17T00:00:00.000Z",
    ...overrides,
  };
}

function installChromeStorageMock(initialValues: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>();

  Object.entries(initialValues).forEach(([key, value]) => {
    store.set(key, value);
  });

  const storageArea: ChromeStorageArea = {
    async get(keys) {
      const key =
        typeof keys === "string"
          ? keys
          : Array.isArray(keys)
            ? keys[0]
            : Object.keys(keys)[0];

      return key ? { [key]: store.get(key) } : {};
    },
    async set(items) {
      Object.entries(items).forEach(([key, value]) => {
        store.set(key, value);
      });
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];

      keyList.forEach((key) => {
        store.delete(key);
      });
    },
  };

  vi.stubGlobal("chrome", {
    storage: {
      local: storageArea,
    },
  });
}

function seedVaultCache(items: VaultSyncItem[]) {
  installChromeStorageMock({
    [POPUP_VAULT_STORAGE_KEY]: JSON.stringify(items),
  });
}

async function setMasterPassword(password: string, confirmation: string = password) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm master password"), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set master password" }));
}

async function unlockVault(password: string) {
  fireEvent.change(await screen.findByLabelText("Master password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Unlock vault" }));
}

describe("App", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows setup mode when no verifier exists", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm master password")).toBeInTheDocument();
  });

  it("unlocks immediately after setting the first master password", async () => {
    render(<App />);

    await setMasterPassword("correct horse");

    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock vault" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search vault")).toBeInTheDocument();
    expect(screen.getByText("No vault items yet.")).toBeInTheDocument();
  });

  it("shows locked mode when a verifier exists", async () => {
    installChromeStorageMock({
      [MASTER_PASSWORD_VERIFIER_STORAGE_KEY]: JSON.stringify(
        createMasterPasswordVerifier("correct horse"),
      ),
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm master password")).not.toBeInTheDocument();
  });

  it("shows an error for a wrong master password", async () => {
    installChromeStorageMock({
      [MASTER_PASSWORD_VERIFIER_STORAGE_KEY]: JSON.stringify(
        createMasterPasswordVerifier("correct horse"),
      ),
    });

    render(<App />);

    await unlockVault("wrong battery");

    expect(await screen.findByText("Wrong master password")).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("returns to locked mode after remount", async () => {
    const firstRender = render(<App />);

    await setMasterPassword("correct horse");
    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();

    firstRender.unmount();
    render(<App />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("shows cached vault items after unlock", async () => {
    seedVaultCache([
      createVaultItem(),
      createVaultItem({
        id: "item-2",
        title: "Linear",
        encrypted_payload: {
          schema_version: 1,
          username: "bob@example.com",
          password_ciphertext: "",
          notes: "",
        },
        updated_at: "2026-03-17T01:00:00.000Z",
      }),
    ]);

    render(<App />);

    await setMasterPassword("correct horse");

    expect(await screen.findByText("Linear")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("filters cached items by title", async () => {
    seedVaultCache([
      createVaultItem(),
      createVaultItem({
        id: "item-2",
        title: "Linear",
        encrypted_payload: {
          schema_version: 1,
          username: "bob@example.com",
          password_ciphertext: "",
          notes: "",
        },
      }),
    ]);

    render(<App />);

    await setMasterPassword("correct horse");
    fireEvent.change(await screen.findByPlaceholderText("Search vault"), {
      target: { value: "git" },
    });

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("Linear")).not.toBeInTheDocument();
  });

  it("filters cached items by username", async () => {
    seedVaultCache([
      createVaultItem(),
      createVaultItem({
        id: "item-2",
        title: "Linear",
        encrypted_payload: {
          schema_version: 1,
          username: "bob@example.com",
          password_ciphertext: "",
          notes: "",
        },
      }),
    ]);

    render(<App />);

    await setMasterPassword("correct horse");
    fireEvent.change(await screen.findByPlaceholderText("Search vault"), {
      target: { value: "bob@" },
    });

    expect(screen.getByText("Linear")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  });

  it("filters cached items by notes", async () => {
    seedVaultCache([
      createVaultItem(),
      createVaultItem({
        id: "item-2",
        title: "Notion",
        encrypted_payload: {
          schema_version: 1,
          username: "workspace@example.com",
          password_ciphertext: "",
          notes: "Shared workspace access",
        },
      }),
    ]);

    render(<App />);

    await setMasterPassword("correct horse");
    fireEvent.change(await screen.findByPlaceholderText("Search vault"), {
      target: { value: "workspace" },
    });

    expect(screen.getByText("Notion")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  });

  it("shows a no-match state when search returns no items", async () => {
    seedVaultCache([createVaultItem()]);

    render(<App />);

    await setMasterPassword("correct horse");
    fireEvent.change(await screen.findByPlaceholderText("Search vault"), {
      target: { value: "does-not-exist" },
    });

    expect(screen.getByText("No vault items match your search.")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  });
});
