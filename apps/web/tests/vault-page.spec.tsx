// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VaultPage from "../src/app/vault/page";

afterEach(() => {
  cleanup();
  mocks.getSession.mockReset();
  mocks.syncVault.mockReset();
});

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  syncVault: vi.fn(),
}));

vi.mock("../src/lib/supabase-browser", () => ({
  createBrowserSupabaseClient: () => ({
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
});
