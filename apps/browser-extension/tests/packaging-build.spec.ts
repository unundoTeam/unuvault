import { afterEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const distRoot = join(packageRoot, "dist");

const clearDist = () => {
  rmSync(distRoot, { recursive: true, force: true });
};

afterEach(() => {
  clearDist();
});

function stripJsComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

it("build emits a loadable extension bundle", { timeout: 30_000 }, () => {
  clearDist();

  execFileSync("corepack", ["pnpm", "--filter", "@unuvault/browser-extension", "build"], {
    cwd: workspaceRoot,
    stdio: "pipe",
  });

  const manifestPath = join(distRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  expect(manifest.background.service_worker).toBe("background.js");
  expect(manifest.action.default_popup).toBe("popup.html");
  expect(manifest.content_security_policy).toMatchObject({
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  });
  expect(existsSync(join(distRoot, "background.js"))).toBe(true);
  expect(existsSync(join(distRoot, "popup.js"))).toBe(true);
  expect(existsSync(join(distRoot, "popup.html"))).toBe(true);

  const backgroundBundle = stripJsComments(
    readFileSync(join(distRoot, "background.js"), "utf8"),
  );
  const popupBundle = stripJsComments(
    readFileSync(join(distRoot, "popup.js"), "utf8"),
  );

  expect(backgroundBundle).not.toMatch(/\bprocess\.env\b/);
  expect(popupBundle).not.toMatch(/\bprocess\.env\b/);
});
