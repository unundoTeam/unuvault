# Crypto Legacy Smoke Checklist

## Purpose

Use one fixed legacy sample set to manually prove the secure crypto migration still:

- reads pre-upgrade data
- upgrades verifier material after successful unlock
- rewrites edited or imported values into the newest secure format
- fails closed when the password is wrong

## Fixture Source

- Canonical fixed samples live in `tests/fixtures/crypto-legacy-fixtures.ts`
- Use the following constants for all manual checks:
  - `LEGACY_FIXTURE_MASTER_PASSWORD`
  - `LEGACY_FIXTURE_WRONG_MASTER_PASSWORD`
  - `LEGACY_FIXTURE_VAULT_PASSWORD_PLAINTEXT`
  - `LEGACY_FIXTURE_VAULT_ENVELOPE_V1`
  - `LEGACY_FIXTURE_VAULT_ENVELOPE_V2`
  - `LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1`
  - `LEGACY_FIXTURE_DEVELOPER_SECRET_BLOB_V1`

## Web Smoke

1. Seed a signed-in vault item whose `password_ciphertext` is `LEGACY_FIXTURE_VAULT_PASSWORD_PLAINTEXT`.
2. Seed `localStorage["unuvault.web.master-password-verifier"]` with `LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1`.
3. Unlock with `LEGACY_FIXTURE_MASTER_PASSWORD`.
4. Confirm reveal and copy both return `hunter2`.
5. Save the item without changing the password.
6. Confirm the next outgoing `password_ciphertext` is JSON with:
   - `version: 3`
   - `cipher: "xchacha20poly1305-ietf"`
   - `keyDerivation: "argon2id13"`
   - `purpose: "vault-password"`
7. Confirm `localStorage["unuvault.web.master-password-verifier"]` is now `version: 2`.
8. Retry unlock with `LEGACY_FIXTURE_WRONG_MASTER_PASSWORD` and confirm it fails closed.

## Browser Extension Smoke

1. Seed `chrome.storage.local["unuvault.extension.master-password-verifier"]` with `LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1`.
2. Seed `chrome.storage.local["unuvault.extension.popup-vault-items"]` with one login item using:
   - `LEGACY_FIXTURE_VAULT_PASSWORD_PLAINTEXT`
   - then repeat with `LEGACY_FIXTURE_VAULT_ENVELOPE_V2`
3. Open the popup and unlock with `LEGACY_FIXTURE_MASTER_PASSWORD`.
4. Confirm search, reveal, and copy all work.
5. Lock and unlock again, then confirm previously revealed plaintext is no longer shown until reveal is clicked again.
6. Confirm the stored verifier has been rewritten to `version: 2`.
7. Confirm unlock with `LEGACY_FIXTURE_WRONG_MASTER_PASSWORD` fails closed.

## CLI Dev Secrets Smoke

1. Seed the dev-secrets record ciphertext with `LEGACY_FIXTURE_DEVELOPER_SECRET_BLOB_V1`.
2. Run `bash scripts/secrets/provider.sh read --app unundo --env local`.
3. Enter `LEGACY_FIXTURE_MASTER_PASSWORD` and confirm:
   - plaintext dotenv prints only to `stdout`
   - `stderr` does not contain any secret value
4. Re-run with `LEGACY_FIXTURE_WRONG_MASTER_PASSWORD` and confirm:
   - exit is non-zero
   - `stderr` contains `decrypt_failed`
   - `stderr` does not contain any dotenv line
5. Run `bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env`.
6. Confirm the uploaded ciphertext is now JSON with:
   - `version: 2`
   - `cipher: "xchacha20poly1305-ietf"`
   - `keyDerivation: "argon2id13"`
   - `purpose: "developer-secret-blob"`

## Exit Criteria

- All legacy reads succeed with the correct password
- All wrong-password cases fail closed
- Successful setup or unlock rewrites the legacy verifier to `v2`
- Successful save, edit, or import rewrites legacy vault or dev-secret values to the newest secure version
- No UI or CLI error path leaks plaintext to logs or `stderr`
