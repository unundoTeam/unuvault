import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const ORIGINAL_ENV = process.env;

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("createProductBrowserClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    const { createProductBrowserClient } = await import(
      "../src/lib/supabase/browser"
    );

    expect(() => createProductBrowserClient()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates the browser client from the public product env pair", async () => {
    createClientMock.mockReturnValue({ kind: "browser-client" });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://product.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "product-anon";

    const { createProductBrowserClient } = await import(
      "../src/lib/supabase/browser"
    );

    expect(createProductBrowserClient()).toEqual({ kind: "browser-client" });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://product.example",
      "product-anon",
    );
  });
});
