// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VaultPage from "../src/app/vault/page";

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

describe("React/CSS adapter evidence for the vault surface", () => {
  it("maps the approved Pencil workspace to durable React/CSS selectors", async () => {
    mockVaultItems();

    render(<VaultPage />);

    const heading = await screen.findByRole("heading", { name: "Vault" });
    const surface = heading.closest("[data-unu-primitive='vault-surface']");
    const unlockForm = screen.getByRole("form", { name: "Unlock vault" });
    const saveForm = screen.getByRole("form", { name: "Save vault item" });
    const itemList = screen.getByRole("list");

    expect(heading.closest("main")).toHaveClass("vault-page");
    expect(surface).toHaveClass("vault-shell");
    expect(
      screen
        .getByText("Keep your current unuvault items in sync across every trusted surface.")
        .closest(".vault-header"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search vault")).toHaveAttribute(
      "placeholder",
      "Search vault",
    );
    expect(screen.getByText("Review state")).toHaveClass("vault-review-label");
    expect(unlockForm.closest(".vault-panel")).toHaveClass("vault-panel--unlock");
    expect(saveForm.closest(".vault-card")).toHaveClass("vault-card--create");
    expect(itemList.closest(".vault-panel")).toHaveClass("vault-panel--items");

    const cssSource = readFileSync("src/app/globals.css", "utf8");
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

    fireEvent.change(screen.getByLabelText("Search vault"), {
      target: { value: "bank" },
    });

    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
    expect(screen.getByText("Bank")).toBeInTheDocument();
  });

  it("exposes semantic primitive hooks on real vault controls", async () => {
    mockVaultItems();

    render(<VaultPage />);

    expect(await screen.findByRole("heading", { name: "Vault" })).toBeInTheDocument();
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

    expect(screen.getByRole("form", { name: "Save vault item" })).toHaveAttribute(
      "data-unu-primitive",
      "form/save-item",
    );
    expect(screen.getByLabelText("Title")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Username")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Website")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save item" })).toBeEnabled();

    expect(screen.getByText("GitHub").closest("li")).toHaveAttribute(
      "data-unu-primitive",
      "row/vault-item",
    );
    expect(screen.getByRole("button", { name: "Copy username GitHub" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Copy password GitHub" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password GitHub" })).toBeDisabled();
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

    const enabledKeyboardControls = getEnabledKeyboardControls();
    const expectedKeyboardOrder = [
      screen.getByLabelText("Master password"),
      screen.getByLabelText("Confirm master password"),
      screen.getByRole("button", { name: "Set master password" }),
      screen.getByLabelText("Title"),
      screen.getByLabelText("Username"),
      screen.getByLabelText("Website"),
      screen.getByLabelText("Notes"),
      screen.getByRole("button", { name: "Save item" }),
      screen.getByLabelText("Search vault"),
      screen.getByRole("button", { name: "Copy username GitHub" }),
      screen.getByRole("button", { name: "Edit GitHub" }),
      screen.getByRole("button", { name: "Delete GitHub" }),
    ];

    expect(enabledKeyboardControls).toEqual(expectedKeyboardOrder);

    for (const control of expectedKeyboardOrder) {
      control.focus();
      expect(control).toHaveFocus();
    }

    for (const unavailableControl of [
      screen.getByLabelText("Password"),
      screen.getByRole("button", { name: "Show password" }),
      screen.getByRole("button", { name: "Copy password GitHub" }),
      screen.getByRole("button", { name: "Show password GitHub" }),
    ]) {
      expect(unavailableControl).toBeDisabled();
      expect(enabledKeyboardControls).not.toContain(unavailableControl);
    }

    const cssSource = readFileSync("src/app/globals.css", "utf8");
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
