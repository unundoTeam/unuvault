# Unundo Unuvault Local Secrets Bridge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `unundo` load `local` environment variables from a private `unuvault`-stored `dotenv` blob through a local-only interactive provider.

**Architecture:** Add a gated `/dev/secrets` surface to `unuvault`, backed by a dedicated encrypted record store and a browser-to-CLI handoff flow. Keep decryption in the terminal, expose stable local shell entrypoints for `import` and `read`, and teach `unundo` to call that provider only for `local` developer workflows.

**Tech Stack:** TypeScript, Fastify, Next.js, Supabase SQL migrations, Vitest, Bash, Python unittest

---

## File Structure

- Create: `packages/security/src/developer-secret-envelope.ts`
  Dedicated blob encryption helper for opaque developer-secret text.
- Create: `packages/security/tests/developer-secret-envelope.spec.ts`
  Focused tests for blob encrypt/decrypt and failure behavior.
- Create: `packages/api-client/src/dev-secrets.ts`
  Shared fetch helpers for handoff create/exchange and record read/write.
- Create: `packages/api-client/tests/dev-secrets-client.spec.ts`
  Client contract tests for the new dev-secrets endpoints.
- Create: `infra/supabase/migrations/0004_developer_secret_records.sql`
  Dedicated server-side storage for private developer-secret records.
- Create: `apps/api/src/lib/dev-secret-session-store.ts`
  In-memory local handoff-code and short-lived CLI-session store.
- Create: `apps/api/src/services/dev-secrets-service.ts`
  Record validation, ownership enforcement, handoff orchestration, and ciphertext persistence.
- Create: `apps/api/src/routes/dev-secrets.ts`
  `/dev/secrets` route registration and request/response handling.
- Create: `apps/api/tests/dev-secrets.spec.ts`
  Route and service tests for handoffs, private records, and error paths.
- Modify: `apps/api/src/app.ts`
  Register the new route behind a local-development feature flag.
- Create: `apps/web/src/app/dev/secrets/handoff/page.tsx`
  Browser handoff page that uses the existing web auth session.
- Create: `apps/web/src/lib/dev-secrets/browser-handoff.ts`
  Small browser-side handoff helper for the local bridge page.
- Create: `apps/web/tests/dev-secrets-handoff-page.spec.tsx`
  Tests for authenticated and unauthenticated handoff behavior.
- Modify: `apps/web/src/components/auth/register-form.tsx`
  Preserve a caller-provided `next` path so the handoff page can round-trip through the current auth callback flow.
- Modify: `apps/web/src/app/register/page.tsx`
  Pass through the handoff `next` path into the register form.
- Create: `scripts/secrets/provider.ts`
  Interactive local CLI implementation for `import` and `read`.
- Create: `scripts/secrets/provider.sh`
  Stable shell wrapper used by `unundo`.
- Modify: `package.json`
  Add a stable local script entrypoint for the provider implementation if needed by the wrapper.
- Modify: `README.md`
  Document the local-only dev-secrets bridge and its gate flag.
- Modify: `../unundo/scripts/env/load-env.sh`
  Add `UNUNDO_SECRETS_PROVIDER=unuvault` local-only provider support.
- Modify: `../unundo/scripts/env/README.md`
  Document the new provider and its local-only constraint.
- Modify: `../unundo/scripts/ios/sync-local-xcconfig.sh`
  Update usage text and local-provider messaging as needed.
- Create: `../unundo/scripts/ci/tests/test_load_env_unuvault_provider.py`
  Regression tests for the new provider branch.
- Create: `../unundo/scripts/ci/tests/test_sync_local_xcconfig_unuvault_provider.py`
  Regression tests for local xcconfig sync with the provider output.

## Chunk 1: Add encrypted developer-secret storage in `unuvault`

### Task 1: Write failing tests for the developer-secret envelope helper

**Files:**
- Create: `packages/security/tests/developer-secret-envelope.spec.ts`
- Create: `packages/security/src/developer-secret-envelope.ts`

- [ ] **Step 1: Add a failing round-trip test for opaque blob encryption**

```ts
it("round-trips a dotenv blob with the master password", () => {
  const ciphertext = sealDeveloperSecretBlob("SUPABASE_URL=https://example\n", "correct horse");
  expect(openDeveloperSecretBlob(ciphertext, "correct horse")).toBe(
    "SUPABASE_URL=https://example\n",
  );
});
```

- [ ] **Step 2: Add failing tests for wrong-password and malformed-payload failure**

```ts
expect(openDeveloperSecretBlob(ciphertext, "wrong horse")).toBe("");
expect(openDeveloperSecretBlob("not-json", "correct horse")).toBe("");
```

- [ ] **Step 3: Run the focused security tests and verify they fail**

Run: `./node_modules/.bin/vitest run packages/security/tests/developer-secret-envelope.spec.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 4: Implement the minimal helper**

Implementation notes:
- keep the API string-in, string-out
- do not reuse legacy login-item plaintext fallback
- keep the envelope versioned

- [ ] **Step 5: Re-run the focused security tests**

Run: `./node_modules/.bin/vitest run packages/security/tests/developer-secret-envelope.spec.ts`
Expected: PASS

### Task 2: Add the dedicated record table and API service tests

**Files:**
- Create: `infra/supabase/migrations/0004_developer_secret_records.sql`
- Create: `apps/api/tests/dev-secrets.spec.ts`
- Create: `apps/api/src/services/dev-secrets-service.ts`
- Create: `apps/api/src/lib/dev-secret-session-store.ts`
- Create: `apps/api/src/routes/dev-secrets.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add failing API tests for private record read/write and secret-not-found**

```ts
it("returns 404 when the private dotenv record does not exist", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/dev/secrets/records/unundo/local/dotenv",
    headers: { authorization: "Bearer cli-session-token" },
  });

  expect(response.statusCode).toBe(404);
});
```

- [ ] **Step 2: Add failing tests for local handoff creation and exchange**

```ts
it("creates a one-time handoff and exchanges it for a short-lived cli session", async () => {
  // browser bearer token -> handoff code -> cli session token
});
```

- [ ] **Step 3: Run the focused API tests and verify they fail**

Run: `./node_modules/.bin/vitest run apps/api/tests/dev-secrets.spec.ts`
Expected: FAIL because `/dev/secrets` is not registered yet.

- [ ] **Step 4: Add the migration and service implementation**

Implementation notes:
- table uniqueness should be `owner_account_id + app_code + target_env + secret_kind`
- first version only accepts `unundo/local/dotenv`
- use an in-memory store for handoff codes and CLI session tokens
- gate route registration on `UNUVAULT_ENABLE_DEV_SECRETS=1`

- [ ] **Step 5: Register the route and re-run the focused API tests**

Run: `./node_modules/.bin/vitest run apps/api/tests/dev-secrets.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit the storage and API slice**

```bash
git add packages/security/src/developer-secret-envelope.ts packages/security/tests/developer-secret-envelope.spec.ts infra/supabase/migrations/0004_developer_secret_records.sql apps/api/src/lib/dev-secret-session-store.ts apps/api/src/services/dev-secrets-service.ts apps/api/src/routes/dev-secrets.ts apps/api/src/app.ts apps/api/tests/dev-secrets.spec.ts
git commit -m "feat: add local developer secret storage"
```

## Chunk 2: Build the `unuvault` browser handoff and local CLI

### Task 3: Add failing tests for API client helpers and browser handoff

**Files:**
- Create: `packages/api-client/src/dev-secrets.ts`
- Create: `packages/api-client/tests/dev-secrets-client.spec.ts`
- Create: `apps/web/src/app/dev/secrets/handoff/page.tsx`
- Create: `apps/web/src/lib/dev-secrets/browser-handoff.ts`
- Create: `apps/web/tests/dev-secrets-handoff-page.spec.tsx`
- Modify: `apps/web/src/components/auth/register-form.tsx`
- Modify: `apps/web/src/app/register/page.tsx`

- [ ] **Step 1: Add failing API client tests for handoff create/exchange and record read/write**

```ts
it("posts to /dev/secrets/handoffs with bearer auth", async () => {
  // expect fetcher called with /dev/secrets/handoffs
});
```

- [ ] **Step 2: Add a failing browser handoff test for an authenticated session**

```ts
it("mints a handoff code and redirects the browser to the loopback callback", async () => {
  // expect browser helper to call the client and redirect with code + state
});
```

- [ ] **Step 3: Add a failing handoff-page test for the unauthenticated case**

```ts
it("sends the user through the existing auth flow when no browser session exists", async () => {
  // expect register link or redirect preserving next=/dev/secrets/handoff...
});
```

- [ ] **Step 4: Run the focused client and web tests**

Run: `./node_modules/.bin/vitest run packages/api-client/tests/dev-secrets-client.spec.ts apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: FAIL because the new helpers and page do not exist yet.

- [ ] **Step 5: Implement the minimal client helpers and handoff page**

Implementation notes:
- preserve the caller-provided `next` path through the existing register flow
- use the current browser identity session as the browser auth source
- do not add a broad secrets-management UI

- [ ] **Step 6: Re-run the focused client and web tests**

Run: `./node_modules/.bin/vitest run packages/api-client/tests/dev-secrets-client.spec.ts apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: PASS

### Task 4: Add the stable local CLI entrypoints

**Files:**
- Create: `scripts/secrets/provider.ts`
- Create: `scripts/secrets/provider.sh`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add failing CLI tests or harness assertions around stdout-only success and stderr-only failure**

Implementation note:
- if a dedicated test harness is too expensive, write a small Vitest or shell-based harness around the TypeScript command module before wiring the shell wrapper

- [ ] **Step 2: Implement `read`**

Implementation notes:
- start a loopback listener
- open the browser handoff page only when no CLI session token is available
- prompt for the master password
- fetch ciphertext, decrypt it, validate conservative dotenv, print to stdout
- print nothing to stdout on failure

- [ ] **Step 3: Implement `import`**

Implementation notes:
- accept only `--from <absolute-file-path>`
- validate conservative dotenv before login and before upload
- print safe summary only: target, source path, size, digest
- require confirmation before overwrite

- [ ] **Step 4: Add the stable shell wrapper**

```bash
bash scripts/secrets/provider.sh read --app unundo --env local
```

- [ ] **Step 5: Run focused `unuvault` verification**

Run: `./node_modules/.bin/vitest run packages/security/tests/developer-secret-envelope.spec.ts packages/api-client/tests/dev-secrets-client.spec.ts apps/api/tests/dev-secrets.spec.ts apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: PASS

- [ ] **Step 6: Commit the browser and CLI bridge**

```bash
git add packages/api-client/src/dev-secrets.ts packages/api-client/tests/dev-secrets-client.spec.ts apps/web/src/app/dev/secrets/handoff/page.tsx apps/web/src/lib/dev-secrets/browser-handoff.ts apps/web/tests/dev-secrets-handoff-page.spec.tsx apps/web/src/components/auth/register-form.tsx apps/web/src/app/register/page.tsx scripts/secrets/provider.ts scripts/secrets/provider.sh package.json README.md
git commit -m "feat: add local unuvault secrets bridge entrypoints"
```

## Chunk 3: Integrate `unundo` with the new provider

### Task 5: Add failing regression tests in `unundo`

**Files:**
- Create: `../unundo/scripts/ci/tests/test_load_env_unuvault_provider.py`
- Create: `../unundo/scripts/ci/tests/test_sync_local_xcconfig_unuvault_provider.py`
- Modify: `../unundo/scripts/env/load-env.sh`
- Modify: `../unundo/scripts/env/README.md`
- Modify: `../unundo/scripts/ios/sync-local-xcconfig.sh`

- [ ] **Step 1: Add a failing `load-env.sh` regression test for the new provider**

```python
def test_local_unuvault_provider_sources_stdout_and_sets_env_source(self) -> None:
    # mock the provider command to emit dotenv and assert UNUNDO_ENV_SOURCE
```

- [ ] **Step 2: Add a failing regression test for non-local or CI rejection**

```python
def test_unuvault_provider_rejects_production_and_ci(self) -> None:
    # expect non-zero exit and clear error text
```

- [ ] **Step 3: Add a failing local xcconfig sync regression**

```python
def test_sync_local_xcconfig_accepts_values_loaded_from_unuvault_provider(self) -> None:
    # verify SUPABASE_URL and SUPABASE_ANON_KEY reach the xcconfig file
```

- [ ] **Step 4: Run the focused `unundo` tests and verify they fail**

Run: `python3 -m unittest scripts/ci/tests/test_load_env_unuvault_provider.py scripts/ci/tests/test_sync_local_xcconfig_unuvault_provider.py -v`
Expected: FAIL because the provider branch does not exist yet.

- [ ] **Step 5: Implement the provider branch in `load-env.sh`**

Implementation notes:
- support `UNUNDO_SECRETS_PROVIDER=unuvault`
- allow only normalized `local`
- reject CI immediately
- call the stable `unuvault` shell wrapper
- use process substitution instead of a plaintext temp file
- set `UNUNDO_ENV_SOURCE=unuvault:unundo/local/dotenv`

- [ ] **Step 6: Update `sync-local-xcconfig.sh` usage text and docs**

Implementation notes:
- mention `unuvault` in the supported provider list
- keep `auto` as the default when no provider is set

- [ ] **Step 7: Re-run the focused `unundo` tests**

Run: `python3 -m unittest scripts/ci/tests/test_load_env_unuvault_provider.py scripts/ci/tests/test_sync_local_xcconfig_unuvault_provider.py -v`
Expected: PASS

- [ ] **Step 8: Commit the `unundo` provider integration**

```bash
git -C ../unundo add scripts/env/load-env.sh scripts/env/README.md scripts/ios/sync-local-xcconfig.sh scripts/ci/tests/test_load_env_unuvault_provider.py scripts/ci/tests/test_sync_local_xcconfig_unuvault_provider.py
git -C ../unundo commit -m "feat: add local unuvault secrets provider"
```

## Chunk 4: Cross-repo verification and handoff

### Task 6: Run the standard local checks and manual smoke

**Files:**
- Verify only

- [ ] **Step 1: Run `unuvault` standard verification**

Run: `corepack pnpm lint && corepack pnpm test`
Expected: PASS

- [ ] **Step 2: Run `unundo` standard local verification**

Run: `bash scripts/testing/test-runner.sh --pre-push-fast`
Expected: PASS

- [ ] **Step 3: Run the local import smoke from `unuvault`**

Run:

```bash
bash scripts/secrets/provider.sh import --app unundo --env local --from /absolute/path/to/local.env
```

Expected:
- browser opens if no local CLI session exists
- terminal prompts for master password
- overwrite confirmation shows safe summary only
- command exits 0

- [ ] **Step 4: Run the local read smoke from `unuvault`**

Run:

```bash
bash scripts/secrets/provider.sh read --app unundo --env local | python3 -c 'import sys; data = sys.stdin.read(); print(len(data))'
```

Expected:
- wrong password path prints nothing to stdout
- success path emits a non-zero plaintext length without writing a temp file

- [ ] **Step 5: Run the `unundo` env loader smoke**

Run:

```bash
UNUNDO_SECRETS_PROVIDER=unuvault source scripts/env/load-env.sh local
```

Expected:
- env loads successfully
- `UNUNDO_ENV_SOURCE=unuvault:unundo/local/dotenv`

- [ ] **Step 6: Run the iOS local config sync smoke**

Run:

```bash
UNUNDO_SECRETS_PROVIDER=unuvault bash scripts/ios/sync-local-xcconfig.sh --env local
```

Expected:
- `apps/ios/Debug.local.xcconfig` is written or updated
- values are usable by the existing helper checks

- [ ] **Step 7: Check formatting and diff hygiene in both repos**

Run:

```bash
git diff --check
git -C ../unundo diff --check
```

Expected: no output
