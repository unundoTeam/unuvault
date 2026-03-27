# Unundo Unuvault Local Secrets Bridge Design

**Problem:** `unundo` local environment loading currently depends on `file`, `op`, or `auto`, which leaves local iOS and local env-driven checks blocked when 1Password is unavailable. We want a first bridge that lets `unundo` read a local-only `dotenv` blob from `unuvault` without turning either repo into a general team-secrets platform or changing CI and release flows.

## Current State

- [`../unundo/scripts/env/load-env.sh`](../../../../unundo/scripts/env/load-env.sh) only supports `UNUNDO_SECRETS_PROVIDER=file|op|auto`, and its `op` path assumes `op read op://Unundo/{env}/dotenv`.
- [`../unundo/scripts/ios/sync-local-xcconfig.sh`](../../../../unundo/scripts/ios/sync-local-xcconfig.sh) and [`../unundo/scripts/testing/lib/ios_suite.sh`](../../../../unundo/scripts/testing/lib/ios_suite.sh) both depend on that loader, so local iOS checks inherit the same secrets-provider limitation.
- [`README.md`](../../../README.md) defines `unuvault` local auth as the browser flow `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`.
- [`docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`](2026-03-14-chinese-password-manager-phase1-design.md) explicitly lists developer secrets and CLI tooling as non-goals for phase 1 user-facing product scope.
- [`apps/web/src/components/vault/use-vault-unlock.ts`](../../../apps/web/src/components/vault/use-vault-unlock.ts), [`packages/security/src/master-password-verifier.ts`](../../../packages/security/src/master-password-verifier.ts), and [`packages/security/src/vault-envelope.ts`](../../../packages/security/src/vault-envelope.ts) already establish the local distinction between identity login and master-password-based decryption.
- `unuvault` currently has no dedicated server-side developer-secret record model, no CLI bridge, and no browser-to-CLI handoff path.

## Approaches

### Option 1: Keep `unundo` on `file/op` and add a local cache wrapper

- Keep `unundo` as the owning repo for secrets loading.
- Add another local cache or export step around the current file / 1Password paths.

Trade-off:
- Minimizes `unuvault` changes, but it does not actually prove that `unuvault` can act as a local development secrets backend.
- It preserves the current provider constraint instead of replacing it with a real bridge.

### Option 2: Build a broader shared secrets platform now

- Add multi-app, multi-env, possibly shared developer secrets inside `unuvault`.
- Add CI and non-local consumption immediately.

Trade-off:
- This quickly becomes a platform and governance project, not a first local bridge.
- It pulls in team sharing, rotation, CI bootstrap, release safety, and a much larger review surface than the current need.

### Option 3: Local-only interactive bridge with a dedicated `dotenv` record (Recommended)

- Add a gated, local-only developer-secret bridge between `unundo` and `unuvault`.
- Keep the namespace stable as `<app>/<env>/dotenv`, but only allow `unundo/local/dotenv` in the first version.
- Keep login in the browser, decryption in the terminal, and plaintext out of the server.

Why this is recommended:
- It validates the real backend substitution we care about.
- It keeps the scope honest: local-only, single-user, interactive, and non-CI.
- It creates a stable namespace and provider shape without prematurely turning `unuvault` into a full general-purpose secrets product.

## Chosen Design

Use option 3 and implement a local-only interactive secrets bridge for `unundo`.

### Core Decisions

- `unundo` gets a new `UNUNDO_SECRETS_PROVIDER=unuvault`, but only for `local`.
- Secrets are addressed as `<app>/<env>/dotenv`; first version only permits `unundo/local/dotenv`.
- The stored record is private to the currently authenticated `unuvault` user.
- `unuvault` stores these records in a dedicated server-side secrets surface, not in the normal vault item list or `/vault/sync`.
- Browser login continues to use the existing `unuvault` web auth path.
- Terminal unlock reuses the same `unuvault` master password.
- The `dotenv` blob is encrypted client-side before upload and decrypted client-side after download.
- The command lifetime is the unlock lifetime; there is no unlock cache in version 1.
- `read` prints plaintext only to `stdout` on full success and never writes a temp plaintext file.

## Architecture

### Gating and scope

This bridge is an explicitly local developer surface, not a normal user-facing feature.

- `unuvault` should gate the browser handoff route, API route registration, and CLI entrypoints behind an explicit local-development flag such as `UNUVAULT_ENABLE_DEV_SECRETS=1`.
- `unundo` should reject `UNUNDO_SECRETS_PROVIDER=unuvault` for non-`local` environments and in CI.
- The first version must fail closed outside those boundaries instead of silently falling back to another provider.

### Storage model

`unuvault` should add a dedicated server-side record table for developer secrets, for example `developer_secret_records`, with fields shaped like:

- `owner_account_id`
- `app_code`
- `target_env`
- `secret_kind`
- `ciphertext`
- `created_at`
- `updated_at`

Rules:

- ownership is keyed by the real `unuidentity` `account_id`
- the uniqueness boundary is `owner_account_id + app_code + target_env + secret_kind`
- first version only allows `secret_kind='dotenv'`
- first version only accepts `app_code='unundo'` and `target_env='local'`

This record family is separate from normal vault items:

- it is not returned by `/vault/sync`
- it is not shown in the normal vault UI
- it is not treated as a login item or synced browser credential

### Encryption model

The `dotenv` blob should not reuse the login-item payload helper directly. Instead, `unuvault` should add a dedicated string-envelope helper in `packages/security`, tailored to opaque developer-secret blobs.

That helper should:

- encrypt any plaintext blob with the current master password
- decrypt only when the same master password is provided
- fail closed on wrong password or malformed payload
- avoid login-item legacy plaintext fallback behavior

The import and read commands use that helper as follows:

- `import`: validate plaintext `dotenv` -> prompt for master password -> encrypt locally -> upload ciphertext
- `read`: fetch ciphertext -> prompt for master password -> decrypt locally -> validate plaintext `dotenv` -> print to `stdout`

The server only stores ciphertext and metadata. It never needs plaintext `dotenv`.

### Browser-to-CLI auth handoff

The browser login must not redirect directly from `unuidentity` to a random loopback port, because the shared auth allow-list is fixed to documented local web callback ports.

The bridge therefore uses `unuvault` web as the handoff coordinator:

1. The CLI starts a loopback listener on `127.0.0.1` and generates a one-time `state`.
2. The CLI opens the local browser to a new `unuvault` handoff page, for example `/dev/secrets/handoff`, with the loopback callback URL and `state`.
3. The handoff page uses the existing `unuvault` browser auth context.
4. If there is no current browser session, the page routes the developer through the existing local auth flow and then returns to the handoff page.
5. Once authenticated, the browser calls a new local API endpoint that mints a one-time handoff code bound to the authenticated account and requested namespace.
6. The browser redirects to the CLI loopback listener with `code` and `state`.
7. The CLI validates `state`, exchanges `code` with the API, receives a short-lived developer-secret session token, and then performs exactly one `read` or `import` request.

This keeps the shared `unuidentity` callback on documented `3001` web routes while still allowing a local loopback CLI callback.

### API surface

The first version should add a dedicated local developer-secret API surface under a prefix such as `/dev/secrets`.

Recommended responsibilities:

- `POST /dev/secrets/handoffs`
  Mint a one-time handoff code for the currently authenticated browser session.
- `POST /dev/secrets/handoffs/exchange`
  Exchange a one-time handoff code for a short-lived CLI session token.
- `GET /dev/secrets/records/:app/:env/dotenv`
  Return ciphertext for the caller's private record.
- `PUT /dev/secrets/records/:app/:env/dotenv`
  Upsert ciphertext for the caller's private record.

The handoff code and CLI session token should be ephemeral and one-time or short-lived. A simple local in-memory store in the API process is acceptable for this first version because the entire feature is local-only and developer-interactive.

### CLI surface

`unuvault` should expose a stable local shell entrypoint, for example:

```bash
bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env
bash scripts/secrets/provider.sh read --app unundo --env local
```

The shell script can wrap a TypeScript implementation, but the shell entrypoint should stay stable so `unundo` can call it without knowing the internal package runner details.

Command rules:

- `import` accepts only file-path input in version 1
- `import` always means full replacement of the target record
- `import` prints a safe summary and requires confirmation before upload
- `read` never writes plaintext to disk
- both commands may trigger browser login when no usable CLI session exists
- both commands prompt for the master password in the terminal

### `unundo` integration

`unundo` should add a new provider branch:

- `UNUNDO_SECRETS_PROVIDER=unuvault`

Behavior:

- only allowed when the normalized target env is `local`
- rejected in CI
- rejected for `staging` and `production`
- no silent fallback to `file`, `op`, or `auto`

Implementation shape:

- `load-env.sh` shells out to `unuvault` `read`
- it sources the provider output from process substitution instead of writing a plaintext temp file
- on success it sets `UNUNDO_ENV_SOURCE=unuvault:unundo/local/dotenv`

Because the accepted payload is intentionally restricted to a conservative `dotenv` subset, `source <(provider-command)` remains a bounded shell-loading path rather than a general shell-script execution feature.

## Data Flow

### Import flow

1. Developer runs the `unuvault` import command with `--app unundo --env local --from <path>`.
2. The CLI validates that the target is allowed in version 1.
3. The CLI parses and validates the source file as conservative `dotenv`.
4. If no active CLI session exists, the CLI starts the loopback listener and opens the browser handoff page.
5. Browser auth completes and returns a one-time handoff code to the CLI listener.
6. CLI exchanges the handoff code for a short-lived CLI session token.
7. CLI prompts for the master password.
8. CLI encrypts the `dotenv` blob locally.
9. CLI prints the target path, source path, file size, and digest summary, then asks for confirmation.
10. After confirmation, the CLI uploads ciphertext to `/dev/secrets/records/unundo/local/dotenv`.

### Read flow

1. `unundo` sets `UNUNDO_SECRETS_PROVIDER=unuvault` and calls `source scripts/env/load-env.sh local`.
2. `load-env.sh` shells out to the `unuvault` provider read command.
3. The provider completes browser handoff if needed.
4. The provider fetches ciphertext for `unundo/local/dotenv`.
5. The provider prompts for the master password.
6. The provider decrypts and validates the plaintext `dotenv`.
7. The provider prints the full `dotenv` blob to `stdout`.
8. `load-env.sh` sources the returned output and continues its existing env normalization logic.

## Error Handling

The bridge should fail hard and clearly.

### General rules

- success means the full expected operation completed
- failure means non-zero exit and no partial success
- secrets plaintext must never be printed to `stderr`
- secrets plaintext must never be printed to `stdout` on failure

### Read failures

Representative failures:

- `not_interactive_tty`
- `browser_open_failed`
- `login_cancelled`
- `login_timeout`
- `callback_bind_failed`
- `callback_state_mismatch`
- `secret_not_found`
- `wrong_master_password`
- `decrypt_failed`
- `invalid_dotenv_payload`

Rules:

- `stdout` stays empty on every failure
- errors are emitted as short one-line diagnostics on `stderr`
- no silent provider fallback in `unundo`

### Import failures

- invalid file path or unreadable file fails before auth
- invalid `dotenv` text fails before encryption or upload
- confirmation decline aborts the write
- wrong master password fails before upload
- existing content is replaced atomically; no merge behavior and no partial overwrite semantics

## Testing

### `unuvault`

- security helper tests for encrypt/decrypt success, wrong-password failure, malformed payload failure
- API route tests for:
  - handoff creation and exchange
  - private namespace enforcement
  - record not found
  - ciphertext-only storage
- CLI tests for:
  - safe summary confirmation
  - `stdout` empty on failure
  - full replacement behavior
- web handoff tests for:
  - existing session happy path
  - unauthenticated browser state handing the developer into the existing auth loop

### `unundo`

- shell or Python regression tests for `load-env.sh` supporting `UNUNDO_SECRETS_PROVIDER=unuvault`
- tests that non-`local` and CI usage fail explicitly
- tests that `UNUNDO_ENV_SOURCE` reflects the `unuvault` path
- tests that iOS local xcconfig sync still works when env values come from the new provider

### Manual smoke

1. import a sample `local.env` into `unuvault`
2. run `read` with no prior CLI session and verify browser handoff occurs
3. verify wrong master password fails without plaintext output
4. run `UNUNDO_SECRETS_PROVIDER=unuvault source scripts/env/load-env.sh local`
5. run `bash ../unundo/scripts/ios/sync-local-xcconfig.sh --env local`

## Success Criteria

- `unundo` can load `local` env values from `unuvault` through a dedicated provider path.
- The stored secret is private to the current authenticated `unuvault` user.
- `unuvault` stores only ciphertext and metadata for the developer-secret record.
- Browser login and CLI loopback handoff work without changing the shared `unuidentity` redirect allow-list to arbitrary ports.
- Normal vault sync, login-item storage, and end-user product surfaces remain unchanged.
- CI, `staging`, and `production` remain outside scope and fail closed.

## Non-Goals

- team-shared developer secrets
- `staging` or `production` support
- CI secrets loading through `unuvault`
- a general-purpose `unuvault` developer CLI product
- a normal end-user web UI for managing developer-secret blobs
- merging or patching individual keys inside `dotenv`
- replacing the current user-facing auth UX with a brand-new CLI-native sign-in system
