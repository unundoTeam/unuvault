# Crypto Legacy Smoke Commands

Replace `PASTE_BEARER_TOKEN` and `/absolute/path/to/local.env` before running.

## 0. Start Services

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

```bash
pnpm --filter @unuvault/browser-extension build
```

Load unpacked extension from `apps/browser-extension/dist`.

Make sure local API env has `UNUVAULT_ENABLE_DEV_SECRETS=1`.

## 1. Web Seed

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/seed-web-legacy-vault-item.mjs \
| tee docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/web-before-item.json
```

In Web console:

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

In Web console:

```js
localStorage.getItem("unuvault.web.master-password-verifier")
```

Save output to `payloads/web-before-verifier.json`.

## 2. Web Manual Checks

Unlock password: `correct horse`

Expected revealed password: `hunter2`

Save:

- `screenshots/web-01-locked-legacy-verifier.png`
- `screenshots/web-02-reveal-legacy-plaintext.png`
- `payloads/web-after-sync-request.json`
- `payloads/web-after-verifier.json`

Expected rewritten fields in `/vault/sync` request:

```text
version: 3
cipher: xchacha20poly1305-ietf
keyDerivation: argon2id13
purpose: vault-password
```

Wrong password check: `wrong battery`

## 3. Extension Seed

Open extension devtools and paste:

```text
docs/operations/evidence/crypto-legacy-smoke-2026-04-15/extension-storage-snippets.js
```

Then run:

```js
await seedLegacyPlaintextSmoke()
await readLegacySmokeState()
```

Save output to `payloads/ext-before-storage.json`.

Unlock password: `correct horse`

Expected revealed password: `hunter2`

After unlock and re-lock, save:

```js
await readLegacySmokeState()
```

Save output to `payloads/ext-after-storage.json`.

Repeat legacy v2 seed:

```js
await seedLegacyV2EnvelopeSmoke()
await readLegacySmokeState()
```

Wrong password check: `wrong battery`

Save:

- `screenshots/ext-01-locked-legacy-verifier.png`
- `screenshots/ext-02-reveal-legacy-v2.png`
- `screenshots/ext-03-after-upgrade-storage.png`

## 4. CLI Seed

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/dev-secrets-record.mjs seed-legacy \
| tee docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/cli-before-record.json
```

## 5. CLI Read

```bash
bash scripts/secrets/provider.sh read --app unundo --env local
```

Enter password: `correct horse`

Save:

- `screenshots/cli-01-read-success.png`

Wrong-password run:

```bash
bash scripts/secrets/provider.sh read --app unundo --env local
```

Enter password: `wrong battery`

Expected stderr contains: `decrypt_failed`

Save:

- `screenshots/cli-02-read-wrong-password.png`

## 6. CLI Import And Readback

```bash
bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env
```

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/dev-secrets-record.mjs read \
| tee docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/cli-after-record.json
```

Expected rewritten fields:

```text
version: 2
cipher: xchacha20poly1305-ietf
keyDerivation: argon2id13
purpose: developer-secret-blob
```

## 7. Final Check

Everything should exist under:

```text
docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/
docs/operations/evidence/crypto-legacy-smoke-2026-04-15/screenshots/
```
