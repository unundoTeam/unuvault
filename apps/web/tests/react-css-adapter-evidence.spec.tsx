// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VaultPage from "../src/app/vault/page";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readWebText(pathFromWebRoot: string): string {
  return readFileSync(resolve(webRoot, pathFromWebRoot), "utf8");
}

afterEach(() => {
  cleanup();
  mocks.getSession.mockReset();
  mocks.syncVault.mockReset();
  mocks.publishLocalCredentialBridgeSession.mockReset();
  mocks.clearLocalCredentialBridgeSession.mockReset();
  window.localStorage.clear();
});

const {
  clearLocalCredentialBridgeSession,
  getSession,
  publishLocalCredentialBridgeSession,
  syncVault,
} = vi.hoisted(() => ({
  clearLocalCredentialBridgeSession: vi.fn().mockResolvedValue({ ok: true }),
  getSession: vi.fn(),
  publishLocalCredentialBridgeSession: vi.fn().mockResolvedValue({ ok: true }),
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
  mocks.publishLocalCredentialBridgeSession.mockResolvedValue({ ok: true });
  mocks.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: "jwt-token",
      },
    },
    error: null,
  });
});

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

function mockVaultItems() {
  mocks.syncVault.mockResolvedValue({
    server_time: "2026-05-23T14:23:00.000Z",
    updated_items: [
      {
        id: "item-github",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: {
          schema_version: 1,
          username: "yuchen",
          password_ciphertext: "sealed-password",
          notes: "2FA recovery codes stored elsewhere.",
          website_url: "https://github.com/login",
        },
        favorite: false,
        source: "manual",
        last_used_at: null,
        created_at: "2026-05-23T14:00:00.000Z",
        updated_at: "2026-05-23T14:00:00.000Z",
      },
    ],
    deleted_item_ids: [],
    conflicts: [],
  });
}

function isDisabledControl(element: HTMLElement): boolean {
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element.disabled;
  }

  return false;
}

function getEnabledKeyboardControls(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      "button, input, textarea, select, a[href], [tabindex]",
    ),
  ).filter((element) => {
    if (element.getAttribute("tabindex") === "-1") {
      return false;
    }

    return !isDisabledControl(element);
  });
}

async function unlockVault(passphrase: string = "correct horse") {
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

  expect(
    await screen.findByText("Vault unlocked", undefined, { timeout: 5000 }),
  ).toBeInTheDocument();
}

async function unlockAndOpenCreatePanel(passphrase?: string) {
  await unlockVault(passphrase);
  fireEvent.click(await screen.findByRole("button", { name: "New login" }));

  return await screen.findByRole("form", { name: "Save vault item" });
}

describe("React/CSS adapter evidence for the vault surface", () => {
  it("maps the approved Pencil workspace to durable React/CSS selectors", async () => {
    mockVaultItems();

    render(<VaultPage />);

    const heading = await screen.findByRole("heading", { name: "Vault" });
    const surface = heading.closest("[data-unu-primitive='vault-surface']");
    const unlockForm = await screen.findByRole("form", { name: "Unlock vault" });
    const itemList = await screen.findByRole("list");

    expect(heading.closest("main")).toHaveClass("vault-page");
    expect(surface).toHaveClass("vault-shell");
    expect(
      screen
        .getByText("Keep your current unuvault items in sync across every trusted surface.")
        .closest(".vault-header"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search vault")).toHaveAttribute(
      "placeholder",
      "Unlock to search",
    );
    expect(screen.getByLabelText("Search vault")).toBeDisabled();
    expect(screen.getByText("Locked state")).toHaveClass("vault-review-label");
    expect(unlockForm.closest(".vault-panel")).toHaveClass("vault-panel--unlock");
    expect(itemList.closest(".vault-panel")).toHaveClass("vault-panel--items");

    const saveForm = await unlockAndOpenCreatePanel();

    expect(screen.getByLabelText("Search vault")).toHaveAttribute(
      "placeholder",
      "Search vault",
    );
    expect(
      screen
        .getAllByText("Unlocked session")
        .some((element) => element.classList.contains("vault-review-label")),
    ).toBe(true);
    expect(saveForm.closest(".vault-card")).toHaveClass("vault-card--create");

    const cssSource = readWebText("src/app/globals.css");
    for (const selector of [
      ".vault-page",
      ".vault-shell",
      ".vault-header",
      ".vault-workspace",
      ".vault-panel",
      ".vault-card",
      ".vault-items-list",
      ".vault-item-row",
      ".vault-action-danger",
      "@media (max-width: 900px)",
    ]) {
      expect(cssSource).toContain(selector);
    }
  });

  it("filters vault rows through the Pencil search control", async () => {
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-05-23T14:23:00.000Z",
      updated_items: [
        {
          id: "item-github",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "yuchen",
            password_ciphertext: "sealed-password",
            notes: "",
            website_url: "https://github.com/login",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-05-23T14:00:00.000Z",
          updated_at: "2026-05-23T14:00:00.000Z",
        },
        {
          id: "item-bank",
          item_type: "login",
          title: "Bank",
          encrypted_payload: {
            schema_version: 1,
            username: "finance@yuchen.dev",
            password_ciphertext: "",
            notes: "",
            website_url: "https://bank.example",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-05-23T14:00:00.000Z",
          updated_at: "2026-05-23T14:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Bank")).toBeInTheDocument();

    await unlockVault();

    fireEvent.change(screen.getByLabelText("Search vault"), {
      target: { value: "bank" },
    });

    const itemList = screen.getByRole("list");

    expect(within(itemList).queryByText("GitHub")).not.toBeInTheDocument();
    expect(within(itemList).getByText("Bank")).toBeInTheDocument();
  });

  it("exposes semantic primitive hooks on real vault controls", async () => {
    mockVaultItems();

    render(<VaultPage />);

    expect(await screen.findByRole("heading", { name: "Vault" })).toBeInTheDocument();
    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Vault" }).closest("[data-unu-primitive]"),
    ).toHaveAttribute("data-unu-primitive", "vault-surface");

    expect(screen.getByRole("form", { name: "Unlock vault" })).toHaveAttribute(
      "data-unu-primitive",
      "form/unlock",
    );
    expect(screen.getByLabelText("Master password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.getByRole("button", { name: "Set master password" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Search vault")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Locked GitHub" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Copy username GitHub" }),
    ).not.toBeInTheDocument();

    const saveForm = await unlockAndOpenCreatePanel();

    expect(saveForm).toHaveAttribute(
      "data-unu-primitive",
      "form/save-item",
    );
    expect(screen.getByLabelText("Title")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Username")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Website")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save item" })).toBeEnabled();

    expect(screen.getByText("GitHub").closest("li")).toHaveAttribute(
      "data-unu-primitive",
      "row/vault-item",
    );
    expect(screen.getByRole("button", { name: "Copy username GitHub" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Copy password GitHub" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show password GitHub" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit GitHub" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Open details GitHub" }));

    expect(screen.getByRole("button", { name: "Copy password GitHub" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show password GitHub" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit GitHub" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete GitHub" })).toBeEnabled();
  });

  it("records status and validation states through semantic live regions", async () => {
    mocks.syncVault.mockResolvedValue({
      server_time: "2026-05-23T14:23:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });

    render(<VaultPage />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Vault synced");
    });
    expect(screen.getByText("No vault items yet.")).toBeInTheDocument();

    await unlockAndOpenCreatePanel();

    fireEvent.submit(screen.getByRole("button", { name: "Save item" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-unu-primitive",
      "state/validation-error",
    );
  });

  it("records keyboard tab order and focus-visible evidence", async () => {
    mockVaultItems();

    render(<VaultPage />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    let enabledKeyboardControls = getEnabledKeyboardControls();
    let expectedKeyboardOrder = [
      screen.getByLabelText("Master password"),
      screen.getByLabelText("Confirm master password"),
      screen.getByRole("button", { name: "Set master password" }),
    ];

    expect(enabledKeyboardControls).toEqual(expectedKeyboardOrder);
    expect(screen.getByLabelText("Search vault")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Locked GitHub" })).toBeDisabled();
    expect(enabledKeyboardControls).not.toContain(screen.getByLabelText("Search vault"));
    expect(enabledKeyboardControls).not.toContain(
      screen.getByRole("button", { name: "Locked GitHub" }),
    );

    await unlockAndOpenCreatePanel();

    enabledKeyboardControls = getEnabledKeyboardControls();
    expectedKeyboardOrder = [
      screen.getByRole("button", { name: "Lock vault" }),
      screen.getByLabelText("Search vault"),
      screen.getByRole("button", { name: "New login" }),
      screen.getByRole("button", { name: "Copy username GitHub" }),
      screen.getByRole("button", { name: "Copy password GitHub" }),
      screen.getByRole("button", { name: "Show password GitHub" }),
      screen.getByRole("button", { name: "Open details GitHub" }),
      screen.getByRole("button", { name: "Edit GitHub" }),
      screen.getByLabelText("Title"),
      screen.getByLabelText("Username"),
      screen.getByLabelText("Website"),
      screen.getByLabelText("Password"),
      screen.getByRole("button", { name: "Show password" }),
      screen.getByLabelText("Notes"),
      screen.getByRole("button", { name: "Save item" }),
    ];

    expect(enabledKeyboardControls).toEqual(expectedKeyboardOrder);

    for (const control of expectedKeyboardOrder) {
      control.focus();
      expect(control).toHaveFocus();
    }

    const cssSource = readWebText("src/app/globals.css");
    for (const selector of [
      ".vault-input:focus-visible",
      ".vault-button:focus-visible",
      ".vault-action-danger:focus-visible",
    ]) {
      expect(cssSource).toContain(selector);
    }
    expect(cssSource).toContain("outline-offset");
  });
});
