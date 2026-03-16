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
              password_ciphertext: "hunter2",
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
              password_ciphertext: "hunter2",
              notes: "Personal account",
            }),
          }),
        ],
        deleted_item_ids: [],
      },
    );
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
              password_ciphertext: "hunter2",
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
            password_ciphertext: "ciphertext-placeholder",
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
            password_ciphertext: "hunter2",
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
            password_ciphertext: "linear-secret",
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
            password_ciphertext: "ciphertext-1",
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

  it("prefills title, username, and notes in edit mode", async () => {
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

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit GitHub" }));

    expect(screen.getByDisplayValue("GitHub")).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Personal account")).toBeInTheDocument();
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
    });

    render(<VaultPage />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();

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

  it("saves edited username and notes through changed_items", async () => {
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
              password_ciphertext: "work-secret",
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
              password_ciphertext: "work-secret",
              notes: "Personal account",
            }),
          }),
        ],
        deleted_item_ids: [],
      },
    );
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
