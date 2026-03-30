# Extension Packaging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real browser-extension build flow that emits a Chrome-loadable `apps/browser-extension/dist/` for the existing background bridge and popup app.

**Architecture:** Keep the current background runtime and popup app logic intact. Add a minimal `esbuild`-based packaging script, a thin popup browser entrypoint, and a static popup HTML shell. Generate the MV3 manifest during build so all manifest paths always point at emitted runtime assets instead of source `.ts` or `.tsx` files.

**Tech Stack:** TypeScript, React, Node.js ESM scripts, `esbuild`, Vitest, Chrome MV3

---

## File Structure

- Modify: `.gitignore`
  Ignore `apps/browser-extension/dist/` so emitted extension assets do not pollute git status.
- Modify: `package.json`
  Add `esbuild` as a direct root devDependency because the workspace does not currently expose it as an importable package.
- Modify: `pnpm-lock.yaml`
  Record the direct `esbuild` dependency.
- Modify: `apps/browser-extension/package.json`
  Add the package-level `build` command.
- Create: `apps/browser-extension/scripts/build.mjs`
  Clean `dist/`, bundle `background/index.ts` and `popup/index.tsx`, emit `manifest.json`, and copy `popup.html`.
- Create: `apps/browser-extension/src/popup/index.tsx`
  Mount the existing popup `App` into `#root`.
- Create: `apps/browser-extension/static/popup.html`
  Provide the popup HTML shell that loads `./popup.js`.
- Create: `apps/browser-extension/tests/packaging-build.spec.ts`
  Verify the package build emits the required runtime assets and manifest paths.

## Chunk 1: Add the failing packaging test

### Task 1: Lock the public build contract with a failing test

**Files:**
- Create: `apps/browser-extension/tests/packaging-build.spec.ts`

- [ ] **Step 1: Write the failing packaging test**

Use a Node-environment Vitest file that runs the public package build command and inspects the emitted bundle:

```ts
import { afterEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(process.cwd(), "apps/browser-extension");
const distRoot = join(packageRoot, "dist");

afterEach(() => {
  rmSync(distRoot, { force: true, recursive: true });
});

it("emits a loadable extension bundle", { timeout: 20_000 }, () => {
  execFileSync(
    "corepack",
    ["pnpm", "--filter", "@unuvault/browser-extension", "build"],
    { cwd: process.cwd(), stdio: "pipe" },
  );

  const manifest = JSON.parse(
    readFileSync(join(distRoot, "manifest.json"), "utf8"),
  );

  expect(manifest.background.service_worker).toBe("background.js");
  expect(manifest.action.default_popup).toBe("popup.html");
});
```

Also assert these files exist:

- `dist/background.js`
- `dist/popup.js`
- `dist/popup.html`

- [ ] **Step 2: Run the focused packaging test to verify it fails**

Run: `corepack pnpm exec vitest --run apps/browser-extension/tests/packaging-build.spec.ts`

Expected: FAIL because `@unuvault/browser-extension` does not have a `build` script yet.

## Chunk 2: Add the packaging surface and emitted assets

### Task 2: Add the direct build dependency and package entrypoint

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/browser-extension/package.json`

- [ ] **Step 1: Ignore the emitted extension bundle**

Add this line to `.gitignore`:

```gitignore
apps/browser-extension/dist/
```

- [ ] **Step 2: Add `esbuild` as a direct root devDependency**

Update `package.json`:

```json
{
  "devDependencies": {
    "esbuild": "^0.27.0"
  }
}
```

Why: `node -e 'import("esbuild")'` currently fails in this repo, so the build script cannot rely on a transitive dependency.

- [ ] **Step 3: Refresh the lockfile**

Run: `corepack pnpm install`

Expected: PASS and `pnpm-lock.yaml` updated for the direct `esbuild` dependency.

- [ ] **Step 4: Add the package build command**

Update `apps/browser-extension/package.json`:

```json
{
  "scripts": {
    "build": "node ./scripts/build.mjs",
    "test": "vitest --run tests",
    "lint": "tsc --noEmit -p tsconfig.json"
  }
}
```

### Task 3: Add the popup browser entry and static HTML shell

**Files:**
- Create: `apps/browser-extension/src/popup/index.tsx`
- Create: `apps/browser-extension/static/popup.html`

- [ ] **Step 1: Add the popup browser entry module**

Create `apps/browser-extension/src/popup/index.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing popup root container.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Add the static popup HTML template**

Create `apps/browser-extension/static/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UnuVault</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./popup.js"></script>
  </body>
</html>
```

### Task 4: Implement the minimal extension build script

**Files:**
- Create: `apps/browser-extension/scripts/build.mjs`

- [ ] **Step 1: Create the build script skeleton**

Start with the filesystem and path setup:

```js
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const distRoot = join(packageRoot, "dist");
```

- [ ] **Step 2: Bundle the background entry**

Add an `esbuild` call equivalent to:

```js
await build({
  bundle: true,
  entryPoints: [join(packageRoot, "src/background/index.ts")],
  format: "esm",
  outfile: join(distRoot, "background.js"),
  platform: "browser",
  target: "chrome120",
});
```

- [ ] **Step 3: Bundle the popup entry**

Add the popup build:

```js
await build({
  bundle: true,
  entryPoints: [join(packageRoot, "src/popup/index.tsx")],
  format: "esm",
  outfile: join(distRoot, "popup.js"),
  platform: "browser",
  target: "chrome120",
});
```

- [ ] **Step 4: Clean `dist/`, copy `popup.html`, and write the manifest**

Use logic like:

```js
await rm(distRoot, { force: true, recursive: true });
await mkdir(distRoot, { recursive: true });
await cp(join(packageRoot, "static/popup.html"), join(distRoot, "popup.html"));

await writeFile(
  join(distRoot, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "UnuVault",
    version: "0.0.1",
    background: {
      service_worker: "background.js",
      type: "module",
    },
    action: {
      default_popup: "popup.html",
    },
    permissions: ["storage"],
  }, null, 2) + "\n",
);
```

- [ ] **Step 5: Run the focused packaging test**

Run: `corepack pnpm exec vitest --run apps/browser-extension/tests/packaging-build.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit the packaging skeleton**

```bash
git add .gitignore package.json pnpm-lock.yaml apps/browser-extension/package.json apps/browser-extension/scripts/build.mjs apps/browser-extension/src/popup/index.tsx apps/browser-extension/static/popup.html apps/browser-extension/tests/packaging-build.spec.ts
git commit -m "build: add extension packaging skeleton"
```

## Chunk 3: Verify the slice and prepare manual smoke check

### Task 5: Re-run affected tests and verify emitted output

**Files:**
- Modify: any files needed only if verification reveals regressions

- [ ] **Step 1: Re-run focused extension regression coverage**

Run: `corepack pnpm exec vitest --run apps/browser-extension/tests/background-message-bridge.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/packaging-build.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the package build directly**

Run: `corepack pnpm --filter @unuvault/browser-extension build`

Expected: PASS and `apps/browser-extension/dist/` contains:

- `manifest.json`
- `background.js`
- `popup.html`
- `popup.js`

- [ ] **Step 3: Run the package lint check**

Run: `corepack pnpm --filter @unuvault/browser-extension lint`

Expected: PASS

- [ ] **Step 4: Inspect the emitted manifest paths**

Run:

```bash
node -e 'const fs=require("node:fs"); const m=JSON.parse(fs.readFileSync("apps/browser-extension/dist/manifest.json","utf8")); console.log(m.background.service_worker); console.log(m.action.default_popup);'
```

Expected output:

```text
background.js
popup.html
```

- [ ] **Step 5: Run diff hygiene**

Run: `git diff --check`

Expected: PASS

- [ ] **Step 6: Capture the remaining manual smoke check**

Record in the handoff that a human still needs to:

1. open Chrome extension management
2. choose `Load unpacked`
3. select `apps/browser-extension/dist/`
4. confirm the popup opens
5. confirm the background service worker is loaded

- [ ] **Step 7: Commit any final verification fixes**

```bash
git add <exact files>
git commit -m "test: verify extension packaging"
```

- [ ] **Step 8: Summarize the result**

Capture:

- the new package-level `build` command
- the emitted `dist/` asset set
- explicit note that the manifest is generated during build
- explicit note that content-script registration remains out of scope
