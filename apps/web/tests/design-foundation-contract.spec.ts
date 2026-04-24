import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "../src/app/globals.css");

const SHARED_FOUNDATION_VARIABLES = [
  "--space-page-padding",
  "--space-section-gap",
  "--space-card-padding",
  "--space-input-padding",
  "--space-panel-padding",
  "--space-surface-padding",
  "--radius-card",
  "--radius-button",
  "--radius-input",
  "--radius-panel",
  "--radius-surface",
  "--shadow-subtle",
  "--shadow-elevated",
  "--motion-duration-fast",
  "--motion-duration-standard",
  "--motion-duration-slow",
  "--motion-duration-enter",
  "--motion-duration-loading",
  "--motion-delay-100",
  "--motion-delay-200",
  "--motion-ease-standard",
  "--motion-ease-enter",
];

describe("design foundation contract", () => {
  it("defines the shared spacing, radius, shadow, and motion variables", () => {
    const css = readFileSync(cssPath, "utf8");

    for (const variableName of SHARED_FOUNDATION_VARIABLES) {
      expect(css).toContain(variableName);
    }
  });
});
