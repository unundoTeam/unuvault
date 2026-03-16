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
