// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("React/CSS adapter evidence for the vault surface", () => {
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
});
