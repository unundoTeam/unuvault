# Crypto Legacy Smoke Evidence Runbook

## Purpose

This folder is the operator-facing execution pack for one real manual run of the legacy crypto smoke checklist.

For the shortest operator path, start with `QUICKSTART.md` in this folder. If you only want copy-run terminal commands, use `COMMANDS.md`. Fall back to this README only when you need the full reference flow.

Use it together with:

- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `tests/fixtures/crypto-legacy-fixtures.ts`

## Folder Layout

- `QUICKSTART.md`
  Ten-minute copy-run version for the manual smoke pass.
- `COMMANDS.md`
  Terminal-first command sheet with the minimum text needed to run the smoke pass.
- `payloads/`
  Store JSON request and response bodies here.
- `screenshots/`
  Store browser, extension, and terminal screenshots here.
- `seed-web-legacy-vault-item.mjs`
  Seeds one Web vault item using a legacy plaintext or caller-provided ciphertext.
- `dev-secrets-record.mjs`
  Seeds or reads the private dev-secrets record through the real API handoff flow.
- `extension-storage-snippets.js`
  Pasteable helper functions for extension devtools.

## Preconditions

1. Start the API: `pnpm dev:api`
2. Start the Web app: `pnpm dev:web`
3. Build the extension: `pnpm --filter @unuvault/browser-extension build`
4. Load unpacked extension from `apps/browser-extension/dist`
5. Ensure API local env enables dev secrets with `UNUVAULT_ENABLE_DEV_SECRETS=1`
6. Sign in to Web once and capture the bearer token from a `POST /vault/sync` request

## Evidence Naming

Recommended screenshots:

- `screenshots/web-01-locked-legacy-verifier.png`
- `screenshots/web-02-reveal-legacy-plaintext.png`
- `screenshots/web-03-after-save-v3-payload.png`
- `screenshots/ext-01-locked-legacy-verifier.png`
- `screenshots/ext-02-reveal-legacy-v2.png`
- `screenshots/ext-03-after-upgrade-storage.png`
- `screenshots/cli-01-read-success.png`
- `screenshots/cli-02-read-wrong-password.png`

Recommended payload files:

- `payloads/web-before-item.json`
- `payloads/web-before-verifier.json`
- `payloads/web-after-sync-request.json`
- `payloads/web-after-verifier.json`
- `payloads/ext-before-storage.json`
- `payloads/ext-after-storage.json`
- `payloads/cli-before-record.json`
- `payloads/cli-after-record.json`

## Step 1: Seed Web Legacy Item

Seed a plaintext legacy item:

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/seed-web-legacy-vault-item.mjs
```

Optional overrides:

- `ITEM_TITLE`
- `ITEM_USERNAME`
- `ITEM_NOTES`
- `ITEM_WEBSITE_URL`
- `LEGACY_PASSWORD_CIPHERTEXT`

Default seed is the fixed plaintext fixture `hunter2`.

## Step 2: Seed Web Legacy Verifier

In the Web page console:

```js
localStorage.setItem(
  "unuvault.web.master-password-verifier",
  JSON.stringify({
    version: 1,
    salt: "AQIDBAUGBwgJCgsM",
    check: "716ba384",
  }),
);
```

Save the seeded item and verifier values to:

- `payloads/web-before-item.json`
- `payloads/web-before-verifier.json`

## Step 3: Run Web Smoke

Follow `docs/operations/crypto-legacy-smoke-checklist.md`:

1. Refresh the vault page.
2. Unlock with `correct horse`.
3. Capture reveal and copy evidence.
4. Save the item without changing the password.
5. Save the outgoing `/vault/sync` request body to `payloads/web-after-sync-request.json`.
6. Save the upgraded verifier value to `payloads/web-after-verifier.json`.

## Step 4: Seed Extension Storage

Open the extension popup or service-worker devtools console, then paste helpers from:

- `docs/operations/evidence/crypto-legacy-smoke-2026-04-15/extension-storage-snippets.js`

Run:

```js
await seedLegacyPlaintextSmoke();
await readLegacySmokeState();
```

Then repeat with:

```js
await seedLegacyV2EnvelopeSmoke();
await readLegacySmokeState();
```

Save before and after storage snapshots to:

- `payloads/ext-before-storage.json`
- `payloads/ext-after-storage.json`

## Step 5: Seed CLI Dev Secret Record

Seed the legacy record through the real API handoff flow:

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/dev-secrets-record.mjs seed-legacy
```

Read the stored record to capture pre- or post-import evidence:

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/dev-secrets-record.mjs read
```

Store these outputs as:

- `payloads/cli-before-record.json`
- `payloads/cli-after-record.json`

## Step 6: Run CLI Smoke

Use the real provider:

```bash
bash scripts/secrets/provider.sh read --app unundo --env local
```

Then:

```bash
bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env
```

Capture:

- success output screenshot
- wrong-password failure screenshot
- post-import record JSON

## Step 7: Close Out

Before you mark the run complete:

1. Check every exit criterion in `docs/operations/crypto-legacy-smoke-checklist.md`
2. Link this evidence directory from the PR description
3. Attach the same directory path in the audit handoff
