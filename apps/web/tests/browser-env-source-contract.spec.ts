import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "..");

function readSource(relativePath: string) {
  return readFileSync(resolve(appRoot, relativePath), "utf8");
}

describe("browser env source contract", () => {
  it("keeps identity browser env access statically analyzable for Next", () => {
    const source = readSource("src/lib/identity/browser.ts");

    expect(source).not.toContain("process.env[name]");
    expect(source).toContain("process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY");
  });

  it("keeps product browser env access statically analyzable for Next", () => {
    const source = readSource("src/lib/supabase/env.ts");

    expect(source).not.toContain("process.env[name]");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
