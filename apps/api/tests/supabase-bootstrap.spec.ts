import { describe, expect, it, vi } from "vitest";
import {
  createConfiguredImportReportService,
  createSupabaseAuthBootstrapDependencies,
} from "../src/lib/supabase";
import { createImportReportService } from "../src/services/import-service";
import { loginPayload } from "./login-payload-fixture";

describe("createSupabaseAuthBootstrapDependencies", () => {
  it("maps auth.getUser into the service dependency contract by resolving account_identities", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: {
        account_id: "account-1",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser },
        from,
      },
      dataClient: {
        from: vi.fn(),
      },
    } as never);

    const user = await deps.getUserByToken("jwt-token");

    expect(getUser).toHaveBeenCalledWith("jwt-token");
    expect(from).toHaveBeenCalledWith("account_identities");
    expect(select).toHaveBeenCalledWith("account_id");
    expect(eq).toHaveBeenCalledWith("auth_user_id", "auth-user-1");
    expect(user).toEqual({
      id: "auth-user-1",
      account_id: "account-1",
      email: "user@example.com",
    });
  });

  it("normalizes missing provider email to null", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-2",
          email: undefined,
        },
      },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("no rows"),
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser },
        from,
      },
      dataClient: {
        from: vi.fn(),
      },
    } as never);

    const user = await deps.getUserByToken("jwt-token");

    expect(from).toHaveBeenCalledWith("account_identities");
    expect(user).toEqual({
      id: "auth-user-2",
      account_id: null,
      email: null,
    });
  });

  it("preserves a missing account_id instead of falling back to auth_user_id", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-3",
          email: "user@example.com",
        },
      },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("no rows"),
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser },
        from,
      },
      dataClient: {
        from: vi.fn(),
      },
    } as never);

    const user = await deps.getUserByToken("jwt-token");

    expect(user).toEqual({
      id: "auth-user-3",
      account_id: null,
      email: "user@example.com",
    });
  });

  it("re-throws unexpected account lookup errors instead of masking them as invalid tokens", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-4",
          email: "user@example.com",
        },
      },
      error: null,
    });
    const lookupError = Object.assign(new Error("database offline"), {
      code: "ECONNRESET",
    });
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: lookupError,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser },
        from,
      },
      dataClient: {
        from: vi.fn(),
      },
    } as never);

    await expect(deps.getUserByToken("jwt-token")).rejects.toBe(lookupError);
  });

  it("upserts users_profile on account_id and returns the profile shape", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "profile-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const getUser = vi.fn();

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser },
      },
      dataClient: {
        from,
      },
    } as never);

    const profile = await deps.upsertUserProfile({
      auth_user_id: "auth-user-1",
      account_id: "account-1",
      email: "user@example.com",
      locale: "zh-CN",
    });

    expect(from).toHaveBeenCalledWith("users_profile");
    expect(getUser).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      {
        auth_user_id: "auth-user-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
      {
        onConflict: "account_id",
      },
    );
    expect(profile).toEqual({
      id: "profile-1",
      account_id: "account-1",
      email: "user@example.com",
      locale: "zh-CN",
    });
  });

  it("finds users_profile by authenticated account_id", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "profile-1",
        account_id: "account-1",
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const getUser = vi.fn();

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser },
      },
      dataClient: {
        from,
      },
    } as never);

    const profile = await deps.getUserProfileByAccountId("account-1");

    expect(from).toHaveBeenCalledWith("users_profile");
    expect(getUser).not.toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith("id, account_id, auth_user_id, email, locale");
    expect(eq).toHaveBeenCalledWith("account_id", "account-1");
    expect(profile).toEqual({
      id: "profile-1",
      account_id: "account-1",
      auth_user_id: "auth-user-1",
      email: "user@example.com",
      locale: "zh-CN",
    });
  });

  it("inserts only allowlisted account-scoped browser import receipt fields", async () => {
    const rawCredentialCanary = "CANARY_RAW_BROWSER_CREDENTIAL";
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        status: "recorded",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    const receipt = await deps.insertBrowserImportReport("profile-1", {
      source: "chrome",
      status: "recorded",
      totals: {
        total_rows: 3,
        accepted_rows: 1,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      duplicates: [
        {
          row_index: 4,
          reason_code: "duplicate",
          duplicate_of_row_index: 2,
        },
      ],
      malformed_rows: [{ row_index: 3, reason_code: "invalid_url" }],
      finished_at: "2026-07-11T08:00:00.000Z",
      raw_csv: rawCredentialCanary,
      account_id: "CANARY_CALLER_ACCOUNT",
      user_profile_id: "CANARY_CALLER_PROFILE",
    } as never);

    expect(from).toHaveBeenCalledWith("import_jobs");
    expect(insert).toHaveBeenCalledWith({
      user_profile_id: "profile-1",
      source: "chrome",
      status: "recorded",
      totals: {
        total_rows: 3,
        accepted_rows: 1,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      duplicates: [
        {
          row_index: 4,
          reason_code: "duplicate",
          duplicate_of_row_index: 2,
        },
      ],
      malformed_rows: [{ row_index: 3, reason_code: "invalid_url" }],
      finished_at: "2026-07-11T08:00:00.000Z",
    });
    expect(JSON.stringify(insert.mock.calls)).not.toContain("CANARY");
    expect(select).toHaveBeenCalledWith("id, status");
    expect(single).toHaveBeenCalledTimes(1);
    expect(receipt).toEqual({
      id: "123e4567-e89b-42d3-a456-426614174000",
      status: "recorded",
    });
  });

  it("re-throws browser import receipt database failures for static service mapping", async () => {
    const insertError = Object.assign(new Error("CANARY_DATABASE_MESSAGE"), {
      code: "PGRST500",
    });
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: insertError,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    await expect(
      deps.insertBrowserImportReport("profile-1", {
        source: "edge",
        status: "recorded",
        totals: {
          total_rows: 0,
          accepted_rows: 0,
          malformed_rows: 0,
          duplicate_rows: 0,
        },
        duplicates: [],
        malformed_rows: [],
        finished_at: "2026-07-11T08:00:00.000Z",
      }),
    ).rejects.toBe(insertError);
  });

  it("lists vault_items for a user profile", async () => {
    const is = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_profile_id: "profile-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: loginPayload(),
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    const items = await deps.listVaultItemsByProfileId("profile-1");

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(select).toHaveBeenCalledWith(
      "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
    );
    expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(items).toEqual([
      {
        id: "item-1",
        user_profile_id: "profile-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: loginPayload(),
        favorite: false,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);
  });

  it("lists deleted vault item ids for a user profile", async () => {
    const not = vi.fn().mockResolvedValue({
      data: [{ id: "item-2" }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ not });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    const ids = await deps.listDeletedVaultItemIdsByProfileId("profile-1");

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
    expect(not).toHaveBeenCalledWith("deleted_at", "is", null);
    expect(ids).toEqual(["item-2"]);
  });

  it("upserts vault_items for a user profile", async () => {
    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const from = vi.fn().mockReturnValue({ upsert });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    await deps.upsertVaultItems("profile-1", [
      {
        id: "item-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: loginPayload(),
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          id: "item-1",
          user_profile_id: "profile-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: loginPayload(),
          favorite: true,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      {
        onConflict: "id",
      },
    );
  });

  it("lists vault_items by id", async () => {
    const inQuery = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_profile_id: "profile-foreign",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: loginPayload(),
          favorite: true,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ in: inQuery });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    const items = await deps.listVaultItemsByIds(["item-1"]);

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(select).toHaveBeenCalledWith(
      "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
    );
    expect(inQuery).toHaveBeenCalledWith("id", ["item-1"]);
    expect(items).toEqual([
      {
        id: "item-1",
        user_profile_id: "profile-foreign",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: loginPayload(),
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);
  });

  it("soft deletes vault_items for a user profile", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const inQuery = vi.fn().mockReturnValue({ eq });
    const update = vi.fn().mockReturnValue({ in: inQuery });
    const from = vi.fn().mockReturnValue({ update });

    const deps = createSupabaseAuthBootstrapDependencies({
      identityClient: {
        auth: { getUser: vi.fn() },
      },
      dataClient: {
        from,
      },
    } as never);

    await deps.softDeleteVaultItems("profile-1", ["item-2"]);

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    });
    expect(inQuery).toHaveBeenCalledWith("id", ["item-2"]);
    expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
  });
});

describe("createConfiguredImportReportService", () => {
  it("returns only the canonical receipt and sanitizes hostile adapter or database failures through the configured dependency composition", async () => {
    const accountSingle = vi.fn().mockResolvedValue({
      data: { account_id: "account-1" },
      error: null,
    });
    const identityClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "auth-user-1", email: "user@example.test" },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: accountSingle }),
        }),
      }),
    };
    const profileSingle = vi.fn().mockResolvedValue({
      data: {
        id: "profile-1",
        account_id: "account-1",
        auth_user_id: "auth-user-1",
        email: "user@example.test",
        locale: "zh-CN",
      },
      error: null,
    });
    const insertSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "123e4567-e89b-42d3-a456-426614174000",
          status: "recorded",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "123e4567-e89b-42d3-a456-426614174000",
          status: "recorded",
          provider_detail: "CANARY_ADAPTER_EXTRA_FIELD",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error("CANARY_DATABASE_PROVIDER_MESSAGE"),
      });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const productClient = {
      from: vi.fn((table: string) => {
        if (table === "users_profile") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: profileSingle }),
            }),
          };
        }
        if (table === "import_jobs") {
          return { insert };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    };
    const validRequest = {
      source: "chrome",
      report: {
        counts: {
          total_rows: 0,
          accepted_rows: 0,
          malformed_rows: 0,
          duplicate_rows: 0,
        },
        issues: [],
      },
    };

    const service = createImportReportService(
      createSupabaseAuthBootstrapDependencies({
        identityClient,
        dataClient: productClient,
      } as never),
    );

    const firstResponse = await service.recordBrowserImportReport(
      "jwt-token",
      validRequest,
    );
    expect(firstResponse).toEqual({
      job_id: "123e4567-e89b-42d3-a456-426614174000",
      status: "recorded",
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let error: unknown;
      try {
        await service.recordBrowserImportReport("jwt-token", validRequest);
      } catch (caught) {
        error = caught;
      }

      expect(error).toMatchObject({
        name: "ImportReportPersistenceError",
        message: "import_report_create_failed",
        code: "import_report_create_failed",
      });
      expect(JSON.stringify(error)).not.toContain("CANARY");
    }

    expect(productClient.from).toHaveBeenCalledWith("users_profile");
    expect(profileSingle).toHaveBeenCalledTimes(3);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(insertSelect).toHaveBeenCalledWith("id, status");
  });

  it("defers configured Supabase environment reads until the first receipt operation", async () => {
    const previousIdentityUrl = process.env.IDENTITY_SUPABASE_URL;
    const previousIdentityKey = process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY;
    const previousProductUrl = process.env.SUPABASE_URL;
    const previousProductKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.IDENTITY_SUPABASE_URL;
    delete process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = "https://product.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-product-service-role-key";

    try {
      const wrapper = createConfiguredImportReportService();

      expect(wrapper).toEqual({
        recordBrowserImportReport: expect.any(Function),
      });
      await expect(
        wrapper.recordBrowserImportReport("jwt-token", {}),
      ).rejects.toThrow("Missing required env var: IDENTITY_SUPABASE_URL");
    } finally {
      if (previousIdentityUrl === undefined) {
        delete process.env.IDENTITY_SUPABASE_URL;
      } else {
        process.env.IDENTITY_SUPABASE_URL = previousIdentityUrl;
      }
      if (previousIdentityKey === undefined) {
        delete process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY;
      } else {
        process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY = previousIdentityKey;
      }
      if (previousProductUrl === undefined) {
        delete process.env.SUPABASE_URL;
      } else {
        process.env.SUPABASE_URL = previousProductUrl;
      }
      if (previousProductKey === undefined) {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      } else {
        process.env.SUPABASE_SERVICE_ROLE_KEY = previousProductKey;
      }
    }
  });
});
