import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const ORIGINAL_ENV = process.env;

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("createProductAdminClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns null when both product admin env vars are absent", async () => {
    const { createProductAdminClient } = await import("../src/lib/supabase");

    await expect(createProductAdminClient()).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws when the product admin config is partial", async () => {
    process.env.SUPABASE_URL = "https://product.example";

    const { createProductAdminClient } = await import("../src/lib/supabase");

    await expect(createProductAdminClient()).rejects.toThrow(
      "Product admin Supabase configuration requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates the admin client from the canonical product admin env pair", async () => {
    createClientMock.mockResolvedValue({ kind: "admin-client" });
    process.env.SUPABASE_URL = "https://product.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { createProductAdminClient } = await import("../src/lib/supabase");

    await expect(createProductAdminClient()).resolves.toEqual({
      kind: "admin-client",
    });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://product.example",
      "service-role-key",
    );
  });
});
