import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "../src/app/globals.css");

describe("design foundation contract", () => {
  it("defines the shared spacing, radius, shadow, and motion variables", () => {
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain("--space-page-padding");
    expect(css).toContain("--radius-card");
    expect(css).toContain("--shadow-subtle");
    expect(css).toContain("--motion-duration-fast");
  });
});
