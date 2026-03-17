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

type SignedOutAuthState = {
  status: "signed_out";
};

type SignedInAuthState = {
  status: "signed_in";
  accessToken: string;
  email: string;
  profileId: string;
  signedInAt: string;
};

type ExtensionAuthState = SignedOutAuthState | SignedInAuthState;

type ExtensionUnlockState = {
  mode: "needs_setup" | "locked" | "unlocked";
};

type BackgroundRequest =
  | {
      type: "read_extension_auth_state";
    }
  | {
      type: "read_extension_unlock_state";
    }
  | {
      type: "sign_in_with_password";
      email: string;
      password: string;
    }
  | {
      type: "unlock_extension_vault";
      passphrase: string;
    }
  | {
      type: "lock_extension_vault";
    }
  | {
      type: "hydrate_popup_vault_cache";
    }
  | {
      type: "sign_out";
    };

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function createSignedInAuthState(): SignedInAuthState {
  return {
    status: "signed_in",
    accessToken: "jwt-token",
    email: "user@example.com",
    profileId: "profile-1",
    signedInAt: "2026-03-17T00:00:00.000Z",
  };
}

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

function createBackgroundMessageHandler(options?: {
  hydrateError?: string | null;
  initialAuthState?: ExtensionAuthState;
  initialUnlockState?: ExtensionUnlockState;
  signInAuthState?: SignedInAuthState;
  unlockError?: string | null;
}) {
  let authState = options?.initialAuthState ?? ({ status: "signed_out" } as const);
  let unlockState = options?.initialUnlockState ?? ({ mode: "needs_setup" } as const);
  let hasVerifier = unlockState.mode !== "needs_setup";
  const signInAuthState = options?.signInAuthState ?? createSignedInAuthState();

  return vi.fn(async (request: BackgroundRequest) => {
    switch (request.type) {
      case "read_extension_auth_state":
        return {
          ok: true,
          authState,
        };
      case "read_extension_unlock_state":
        return {
          ok: true,
          unlockState,
        };
      case "sign_in_with_password":
        authState = signInAuthState;
        return {
          ok: true,
          authState,
        };
      case "unlock_extension_vault":
        if (options?.unlockError) {
          return {
            ok: false,
            error: options.unlockError,
          };
        }

        hasVerifier = true;
        unlockState = {
          mode: "unlocked",
        };

        return {
          ok: true,
          unlockState,
        };
      case "lock_extension_vault":
        unlockState = {
          mode: hasVerifier ? "locked" : "needs_setup",
        };

        return {
          ok: true,
          unlockState,
        };
      case "hydrate_popup_vault_cache":
        if (options?.hydrateError) {
          return {
            ok: false,
            error: options.hydrateError,
          };
        }

        return {
          ok: true,
          result: {
            ok: true,
          },
        };
      case "sign_out":
        authState = {
          status: "signed_out",
        };
        return {
          ok: true,
        };
      default:
        return {
          ok: false,
          error: "Unknown request",
        };
    }
  });
}

function installChromeExtensionMock(options?: {
  initialValues?: Record<string, unknown>;
  sendMessage?: ReturnType<typeof vi.fn>;
}) {
  const store = new Map<string, unknown>();

  Object.entries(options?.initialValues ?? {}).forEach(([key, value]) => {
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
    runtime: {
      sendMessage: options?.sendMessage ?? createBackgroundMessageHandler(),
    },
    storage: {
      local: storageArea,
    },
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

async function signInFromPopup(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
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
    installChromeExtensionMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the auth form when the extension is signed out", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Master password")).not.toBeInTheDocument();
  });

  it("signs in from the popup and then shows setup mode", async () => {
    const sendMessage = createBackgroundMessageHandler();
    installChromeExtensionMock({
      sendMessage,
    });

    render(<App />);

    await signInFromPopup("user@example.com", "correct horse");

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "sign_in_with_password",
      email: "user@example.com",
      password: "correct horse",
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: "hydrate_popup_vault_cache",
    });
  });

  it("requests background hydration when the popup opens with an existing session", async () => {
    const sendMessage = createBackgroundMessageHandler({
      initialAuthState: createSignedInAuthState(),
    });
    installChromeExtensionMock({
      sendMessage,
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "read_extension_auth_state",
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: "hydrate_popup_vault_cache",
    });
  });

  it("reads background unlock state when the popup opens with an existing signed-in session", async () => {
    const sendMessage = createBackgroundMessageHandler({
      initialAuthState: createSignedInAuthState(),
      initialUnlockState: {
        mode: "locked",
      },
    });
    installChromeExtensionMock({
      sendMessage,
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "read_extension_unlock_state",
    });
  });

  it("shows a vault hydration error without clearing signed-in state", async () => {
    installChromeExtensionMock({
      sendMessage: createBackgroundMessageHandler({
        hydrateError: "We couldn't refresh your vault.",
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.getByText("We couldn't refresh your vault.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("shows setup mode when signed in and no verifier exists", async () => {
    installChromeExtensionMock({
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm master password")).toBeInTheDocument();
  });

  it("unlocks immediately after setting the first master password", async () => {
    installChromeExtensionMock({
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    await setMasterPassword("correct horse");

    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock vault" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search vault")).toBeInTheDocument();
    expect(screen.getByText("No vault items yet.")).toBeInTheDocument();
  });

  it("calls background unlock when submitting the master password", async () => {
    const sendMessage = createBackgroundMessageHandler({
      initialAuthState: createSignedInAuthState(),
    });
    installChromeExtensionMock({
      sendMessage,
    });

    render(<App />);

    await setMasterPassword("correct horse");

    expect(sendMessage).toHaveBeenCalledWith({
      type: "unlock_extension_vault",
      passphrase: "correct horse",
    });
  });

  it("shows locked mode when signed in and a verifier exists", async () => {
    installChromeExtensionMock({
      initialValues: {
        [MASTER_PASSWORD_VERIFIER_STORAGE_KEY]: JSON.stringify(
          createMasterPasswordVerifier("correct horse"),
        ),
      },
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm master password")).not.toBeInTheDocument();
  });

  it("shows an error for a wrong master password", async () => {
    installChromeExtensionMock({
      initialValues: {
        [MASTER_PASSWORD_VERIFIER_STORAGE_KEY]: JSON.stringify(
          createMasterPasswordVerifier("correct horse"),
        ),
      },
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    await unlockVault("wrong battery");

    expect(await screen.findByText("Wrong master password")).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("returns to locked mode after remount", async () => {
    installChromeExtensionMock({
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });
    const firstRender = render(<App />);

    await setMasterPassword("correct horse");
    expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();

    firstRender.unmount();
    installChromeExtensionMock({
      initialValues: {
        [MASTER_PASSWORD_VERIFIER_STORAGE_KEY]: JSON.stringify(
          createMasterPasswordVerifier("correct horse"),
        ),
      },
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });
    render(<App />);

    expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
    expect(screen.queryByText("Vault unlocked")).not.toBeInTheDocument();
  });

  it("shows cached vault items after unlock", async () => {
    installChromeExtensionMock({
      initialValues: {
        [POPUP_VAULT_STORAGE_KEY]: JSON.stringify([
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
        ]),
      },
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    await setMasterPassword("correct horse");

    expect(await screen.findByText("Linear")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("filters cached items by title, username, and notes", async () => {
    installChromeExtensionMock({
      initialValues: {
        [POPUP_VAULT_STORAGE_KEY]: JSON.stringify([
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
          createVaultItem({
            id: "item-3",
            title: "Notion",
            encrypted_payload: {
              schema_version: 1,
              username: "workspace@example.com",
              password_ciphertext: "",
              notes: "Shared workspace access",
            },
          }),
        ]),
      },
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    await setMasterPassword("correct horse");
    fireEvent.change(await screen.findByPlaceholderText("Search vault"), {
      target: { value: "git" },
    });
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("Linear")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search vault"), {
      target: { value: "bob@" },
    });
    expect(screen.getByText("Linear")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search vault"), {
      target: { value: "workspace" },
    });
    expect(screen.getByText("Notion")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  });

  it("shows a no-match state when search returns no items", async () => {
    installChromeExtensionMock({
      initialValues: {
        [POPUP_VAULT_STORAGE_KEY]: JSON.stringify([createVaultItem()]),
      },
      sendMessage: createBackgroundMessageHandler({
        initialAuthState: createSignedInAuthState(),
      }),
    });

    render(<App />);

    await setMasterPassword("correct horse");
    fireEvent.change(await screen.findByPlaceholderText("Search vault"), {
      target: { value: "does-not-exist" },
    });

    expect(screen.getByText("No vault items match your search.")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  });
});
