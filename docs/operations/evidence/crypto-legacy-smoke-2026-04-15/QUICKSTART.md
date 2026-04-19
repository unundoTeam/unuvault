# Crypto Legacy Smoke Quickstart

Use this when you want the shortest path through one real manual legacy smoke run.

If you want an even more condensed terminal copy sheet, use `COMMANDS.md`.

## 0. Prep

1. Start API: `pnpm dev:api`
2. Start Web: `pnpm dev:web`
3. Build extension: `pnpm --filter @unuvault/browser-extension build`
4. Load unpacked extension from `apps/browser-extension/dist`
5. Ensure API local env has `UNUVAULT_ENABLE_DEV_SECRETS=1`
6. Sign in to Web once and capture the bearer token from a `POST /vault/sync` request

## 1. Web

Seed one legacy plaintext vault item:

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/seed-web-legacy-vault-item.mjs \
| tee docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/web-before-item.json
```

In the Web page console, seed the legacy verifier:

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

Then:

1. Save `localStorage.getItem("unuvault.web.master-password-verifier")` to `payloads/web-before-verifier.json`
2. Refresh vault page
3. Unlock with `correct horse`
4. Reveal and copy password; expected value is `hunter2`
5. Save screenshot as `screenshots/web-02-reveal-legacy-plaintext.png`
6. Save item without changing password
7. Save outgoing `/vault/sync` request body to `payloads/web-after-sync-request.json`
8. Save upgraded verifier to `payloads/web-after-verifier.json`
9. Confirm rewritten payload contains:
   - `version: 3`
   - `cipher: "xchacha20poly1305-ietf"`
   - `keyDerivation: "argon2id13"`
   - `purpose: "vault-password"`
10. Retry unlock with `wrong battery`; it must fail closed

## 2. Browser Extension

Open extension devtools and paste:

`docs/operations/evidence/crypto-legacy-smoke-2026-04-15/extension-storage-snippets.js`

Run:

```js
await seedLegacyPlaintextSmoke()
await readLegacySmokeState()
```

Save that output to `payloads/ext-before-storage.json`.

Then:

1. Open popup and unlock with `correct horse`
2. Confirm search, copy, and reveal work; expected password is `hunter2`
3. Lock and unlock again; plaintext must stay hidden until reveal is clicked again
4. Save `await readLegacySmokeState()` to `payloads/ext-after-storage.json`
5. Confirm verifier is now `version: 2`
6. Repeat with legacy `v2` item:

```js
await seedLegacyV2EnvelopeSmoke()
await readLegacySmokeState()
```

7. Retry unlock with `wrong battery`; it must fail closed

## 3. CLI Dev Secrets

Seed legacy record:

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/dev-secrets-record.mjs seed-legacy \
| tee docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/cli-before-record.json
```

Run provider read:

```bash
bash scripts/secrets/provider.sh read --app unundo --env local
```

1. Enter `correct horse`
2. Confirm dotenv prints to `stdout`
3. Confirm `stderr` does not leak any secret
4. Save success screenshot as `screenshots/cli-01-read-success.png`

Run provider read again with the wrong password:

```bash
bash scripts/secrets/provider.sh read --app unundo --env local
```

1. Enter `wrong battery`
2. Confirm exit is non-zero
3. Confirm `stderr` contains `decrypt_failed`
4. Confirm `stderr` does not contain any dotenv line
5. Save failure screenshot as `screenshots/cli-02-read-wrong-password.png`

Run import:

```bash
bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env
```

Read back the stored record:

```bash
ACCESS_TOKEN='PASTE_BEARER_TOKEN' \
API_BASE_URL='http://127.0.0.1:3000' \
node docs/operations/evidence/crypto-legacy-smoke-2026-04-15/dev-secrets-record.mjs read \
| tee docs/operations/evidence/crypto-legacy-smoke-2026-04-15/payloads/cli-after-record.json
```

Confirm rewritten payload contains:

- `version: 2`
- `cipher: "xchacha20poly1305-ietf"`
- `keyDerivation: "argon2id13"`
- `purpose: "developer-secret-blob"`

## 4. Done When

- All correct-password reads succeed
- All wrong-password paths fail closed
- Web and extension verifiers are upgraded to `v2`
- Web save rewrites vault payload to secure `v3`
- CLI import rewrites dev-secret blob to secure `v2`
- Evidence files are stored in `payloads/` and `screenshots/`
