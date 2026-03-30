# Extension Packaging Design

## Summary

The browser extension now has a real background runtime bridge in source code, but the repo still cannot produce a Chrome-loadable extension bundle. The current extension package contains tested modules for background logic, popup UI, and content helpers, yet none of them are emitted as browser-executable assets.

That gap matters because the runtime bridge is only truly useful once Chrome can load:

- a real MV3 manifest
- a real background service worker JavaScript file
- a real popup HTML file
- a real popup JavaScript entrypoint

This slice narrows to the minimum viable extension packaging flow:

- add a `build` command for `@unuvault/browser-extension`
- emit `apps/browser-extension/dist/manifest.json`
- emit `apps/browser-extension/dist/background.js`
- emit `apps/browser-extension/dist/popup.html`
- emit `apps/browser-extension/dist/popup.js`

The goal is not to finish extension runtime wiring. The goal is to make the browser extension loadable in Chrome with real built assets for the existing background bridge and popup UI, while explicitly deferring content-script registration and richer runtime behavior to a later slice.

## Scope

### In scope

- add a real packaging/build command for `@unuvault/browser-extension`
- bundle `src/background/index.ts` into browser-executable JavaScript
- add a popup browser entrypoint for `src/popup/App.tsx`
- emit a minimal popup HTML asset that loads the built popup JavaScript
- generate a minimal MV3 manifest that points only to built assets
- write all extension runtime assets into `apps/browser-extension/dist/`
- keep current runtime bridge, popup logic, and tests working
- verify the generated `dist/` can be used with Chrome `Load unpacked`

### Out of scope

- content-script registration in the manifest
- host permissions
- `web_accessible_resources`
- runtime-backed content injection or autofill triggering
- popup UI redesign
- watch mode or hot reload
- extension publishing workflow
- replacing the packaging approach with Vite, Rollup, or a larger bundler stack

## Chosen Approach

The chosen approach is **a minimal `esbuild`-based packaging script that emits only the assets Chrome needs today**.

That means:

- keep the current source layout for background and popup logic
- add a thin popup browser entry module instead of making `App.tsx` itself the entrypoint
- generate the manifest during build so the repo does not contain another fake source-level manifest
- copy or emit only the static files needed for a loadable extension

This is preferred over introducing a larger bundler because the immediate risk is packaging correctness, not frontend developer experience. It is preferred over adding content-script packaging in the same slice because content registration would pull manifest permissions and runtime behavior decisions back into scope.

## Architecture

### Output directory

All runtime assets for this slice should be emitted into:

`apps/browser-extension/dist/`

The generated directory should contain only the minimum viable loadable extension bundle:

- `manifest.json`
- `background.js`
- `popup.html`
- `popup.js`

The build should clean the directory before writing new outputs so old files cannot survive across builds.

### Build script

Add `apps/browser-extension/scripts/build.mjs`.

Responsibilities:

- remove any existing `dist/`
- invoke `esbuild` for the background entry
- invoke `esbuild` for the popup entry
- write `manifest.json` into `dist/`
- copy `static/popup.html` into `dist/`
- fail the process immediately if any packaging step fails

This file should be the only place where extension packaging concerns live in this slice.

### Background output

Use the existing runtime bridge entry:

- source: `apps/browser-extension/src/background/index.ts`
- output: `apps/browser-extension/dist/background.js`

No behavioral changes are required in the background runtime for this slice. Packaging should consume the existing bridge exactly as-is.

### Popup output

Add a dedicated popup browser entry:

- source: `apps/browser-extension/src/popup/index.tsx`
- output: `apps/browser-extension/dist/popup.js`

`index.tsx` should only:

- find `#root`
- create the React root
- render the existing `App`

This keeps `App.tsx` focused on popup behavior while making the browser entry explicit.

### Static popup HTML

Add:

- source template: `apps/browser-extension/static/popup.html`
- emitted asset: `apps/browser-extension/dist/popup.html`

The template should contain only:

- a root container for React
- a module script tag for `./popup.js`

It must not point at source `.tsx` files.

### Manifest generation

The build script should generate `apps/browser-extension/dist/manifest.json` directly.

The manifest should contain only the minimum fields needed for this slice:

- `manifest_version: 3`
- `name`
- `version`
- `background.service_worker: "background.js"`
- `background.type: "module"`
- `action.default_popup: "popup.html"`
- `permissions: ["storage"]`

It should not contain:

- `content_scripts`
- `host_permissions`
- `web_accessible_resources`

Generating the manifest at build time is intentional. It prevents the repo from carrying a misleading package-level manifest whose paths do not correspond to emitted runtime assets.

### Package surface

Update `apps/browser-extension/package.json` to add a real build entry:

- `build`: `node ./scripts/build.mjs`

Existing `test` and `lint` scripts should remain unchanged.

## Data Flow

### Build execution

1. the package build command runs `node ./scripts/build.mjs`
2. the script removes the old `dist/`
3. `esbuild` bundles the background entry into `dist/background.js`
4. `esbuild` bundles the popup entry into `dist/popup.js`
5. the script writes `dist/manifest.json`
6. the script copies `static/popup.html` into `dist/popup.html`
7. Chrome can load `dist/` as an unpacked extension

### Runtime execution after packaging

1. Chrome loads `manifest.json`
2. Chrome starts `background.js` as the MV3 service worker
3. opening the browser action loads `popup.html`
4. `popup.html` loads `popup.js`
5. `popup.js` renders the existing React popup app

This slice stops there. Content scripts are not part of the packaged runtime yet.

## Testing Strategy

### Build verification

Run:

- `corepack pnpm --filter @unuvault/browser-extension build`

Check that:

- `apps/browser-extension/dist/` exists
- `manifest.json` exists
- `background.js` exists
- `popup.html` exists
- `popup.js` exists
- no manifest field points at `.ts` or `.tsx`

### Regression coverage

Re-run the existing extension tests most likely to be affected by packaging entry changes:

- `corepack pnpm exec vitest --run apps/browser-extension/tests/background-message-bridge.spec.ts`
- `corepack pnpm exec vitest --run apps/browser-extension/tests/popup.spec.tsx`

Optional broader regression coverage if the slice touches shared wiring:

- `corepack pnpm exec vitest --run apps/browser-extension/tests/autofill.spec.ts`

### Lint verification

Run:

- `corepack pnpm --filter @unuvault/browser-extension lint`

### Manual smoke check

Use Chrome `Load unpacked` against:

- `apps/browser-extension/dist/`

Verify:

- the extension loads without manifest path errors
- the popup opens
- the background service worker appears as loaded

Do not require:

- content script injection
- page autofill behavior
- host permission prompts

## Risks

### Branch dependency

This packaging slice assumes the runtime bridge slice lands first, or that packaging work is branched from a commit containing `apps/browser-extension/src/background/index.ts`. Without that file, the background packaging target does not exist.

### Missing asset discipline

If the build script leaves stale files in `dist/`, Chrome may appear to load a bundle that no longer matches source. Cleaning `dist/` on every build is required to keep packaging deterministic.

### Manifest drift

If a checked-in manifest is added alongside the generated manifest, the repo can drift back toward fake loadability. This slice should keep the manifest generation logic inside the build step so there is only one source of truth for emitted runtime paths.

### Future bundler migration

The chosen `esbuild` approach is intentionally minimal. It is suitable for the current packaging goal, but it does not attempt to solve future watch-mode or richer asset-pipeline needs.

## Acceptance Criteria

- `@unuvault/browser-extension` has a working `build` command
- running the build emits a Chrome-loadable `apps/browser-extension/dist/`
- the emitted manifest points only to built runtime assets
- the emitted popup loads built JavaScript rather than source `.tsx`
- the emitted background service worker loads built JavaScript rather than source `.ts`
- existing bridge and popup tests still pass
- content-script registration and runtime-backed content wiring remain explicitly deferred
