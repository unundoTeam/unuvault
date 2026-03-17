# Unuvault Identity Cutover Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `unuvault` consume `unuidentity` with a clean cutover so `account_id` always means the real shared identity account id and never falls back to `auth_user_id`.

**Architecture:** Keep `bootstrap` and `vault/sync` keyed by `users_profile.account_id`, but require that value to come from the validated identity context. Remove the `auth_user_id` fallback and stop seeding new `account_id` values from legacy local ids. Treat old test users as disposable pre-launch data rather than migrating them through a compatibility layer.

**Tech Stack:** TypeScript, Fastify, Next.js, Supabase, Vitest, SQL migrations

---

## File Structure

- Modify: `apps/api/src/lib/supabase.ts`
  Remove `auth_user_id` fallback account resolution and fail closed when `account_id` is absent.
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
  Cover strict account-id resolution behavior.
- Modify: `apps/api/tests/auth-bootstrap.spec.ts`
  Cover bootstrap failure when identity context lacks `account_id`.
- Modify: `apps/api/tests/vault-service.spec.ts`
  Cover vault sync failure when identity context lacks `account_id`.
- Modify: `infra/supabase/migrations/0003_users_profile_account_id.sql`
  Remove invalid `auth_user_id -> account_id` backfill.
- Modify: `README.md`
  Document the clean-cutover expectation for local test data.

## Chunk 1: Enforce strict account resolution in the API layer

### Task 1: Add failing tests for missing `account_id`

**Files:**
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
- Modify: `apps/api/tests/auth-bootstrap.spec.ts`
- Modify: `apps/api/tests/vault-service.spec.ts`

- [ ] **Step 1: Add a failing dependency test for identity users without `account_id`**

```ts
it("rejects identity users that do not expose account_id", async () => {
  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: "auth-user-1",
        email: "user@example.com",
      },
    },
    error: null,
  });

  const deps = createSupabaseAuthBootstrapDependencies({
    identityClient: { auth: { getUser } },
    dataClient: { from: vi.fn() },
  } as never);

  await expect(deps.getUserByToken("jwt-token")).rejects.toThrow("missing_account_id");
});
```

- [ ] **Step 2: Add a failing bootstrap service test for missing `account_id`**

Run a test where `getUserByToken()` throws or returns an incomplete identity user, and assert `bootstrapProfileFromToken()` rejects.

- [ ] **Step 3: Add a failing vault-sync test for missing `account_id`**

Create a case where the authenticated identity resolves without `account_id` and assert `syncVaultFromToken()` rejects before profile lookup.

- [ ] **Step 4: Run the focused API tests to verify they fail for the right reason**

Run: `./node_modules/.bin/vitest run apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/vault-service.spec.ts`
Expected: FAIL because the code still falls back to `auth_user_id`

## Chunk 2: Implement the clean-cutover behavior

### Task 2: Remove the `auth_user_id` fallback

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`

- [ ] **Step 1: Replace `extractAccountId()` fallback behavior with a strict guard**

Implementation notes:
- keep reading `app_metadata.account_id` and `user_metadata.account_id`
- if neither is present, throw `new Error("missing_account_id")`
- do not return `user.id`

- [ ] **Step 2: Re-run the focused API tests**

Run: `./node_modules/.bin/vitest run apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/vault-service.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit the API identity resolution fix**

```bash
git add apps/api/src/lib/supabase.ts apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/vault-service.spec.ts
git commit -m "fix: require account ids from identity context"
```

### Task 3: Stop writing fake `account_id` values into product data

**Files:**
- Modify: `infra/supabase/migrations/0003_users_profile_account_id.sql`
- Modify: `README.md`

- [ ] **Step 1: Remove the `auth_user_id -> account_id` backfill from the migration**

Implementation notes:
- keep adding the column and unique index if the slice still needs them
- remove the update that fabricates `account_id` from `auth_user_id`
- document in comments or docs that old test rows should be recreated through the new identity flow

- [ ] **Step 2: Add or update the local setup note in `README.md`**

Document:
- this is a clean cutover for pre-launch test data
- old local users/profiles should be recreated after wiring `unuidentity`
- no automatic compatibility migration is provided

- [ ] **Step 3: Run repository verification**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS with the full JS suite green

- [ ] **Step 4: Commit the cutover docs and migration change**

```bash
git add infra/supabase/migrations/0003_users_profile_account_id.sql README.md
git commit -m "docs: document unuvault identity clean cutover"
```

## Chunk 3: Final verification

### Task 4: Re-run the targeted bridge checks

**Files:**
- Verify only

- [ ] **Step 1: Re-run the focused auth bootstrap and finalize tests**

Run: `./node_modules/.bin/vitest run packages/api-client/tests/auth-client.spec.ts apps/web/tests/finalize-page.spec.tsx apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/vault-service.spec.ts`
Expected: PASS

- [ ] **Step 2: Re-run the full test runner**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 3: Check formatting of the resulting diff**

Run: `git diff --check`
Expected: no output
