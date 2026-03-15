# Vault Sync Auth Context Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /vault/sync` require a real authenticated user context while keeping the current empty sync payload shape.

**Architecture:** Extend the shared vault client so sync requests carry a bearer token, then add a thin Supabase-backed profile resolution path in the API before the vault service runs. The vault service keeps returning the current placeholder payload, but only after the caller has been mapped to a real `users_profile`.

**Tech Stack:** TypeScript, Fastify, Supabase Auth, Supabase Data API, Vitest

---

## File Structure

- Modify: `packages/api-client/src/vault.ts`
  Require an access token and send bearer auth for sync calls.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Cover the new authenticated sync client contract.
- Modify: `apps/api/src/lib/supabase.ts`
  Add a `users_profile` lookup helper keyed by authenticated `auth_user_id`.
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
  Cover the new profile lookup helper in the Supabase dependency adapter.
- Modify: `apps/api/src/services/vault-service.ts`
  Accept a resolved product profile and return the existing sync payload shape.
- Modify: `apps/api/src/routes/vault-sync.ts`
  Enforce bearer auth, resolve the product profile, and map stable error responses.
- Modify: `apps/api/tests/vault-sync.spec.ts`
  Cover missing token, invalid token, missing profile, and successful authenticated sync.
- Modify: `README.md`
  Note that vault sync now requires a Supabase-backed authenticated session.

## Chunk 1: Authenticated sync contract

### Task 1: Add bearer auth to the shared vault client

**Files:**
- Modify: `packages/api-client/src/vault.ts`
- Modify: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing client test**

Update the existing test so it calls:

```ts
await syncVault(fetcher, "jwt-token", { changed_items: [] });
```

and expects:

```ts
expect(fetcher).toHaveBeenCalledWith("/vault/sync", {
  method: "POST",
  headers: {
    authorization: "Bearer jwt-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ changed_items: [] }),
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: FAIL because `syncVault` does not yet accept a token or send `authorization`

- [ ] **Step 3: Implement the minimal authenticated client contract**

Implementation notes:
- change `syncVault` to `syncVault(fetcher, token, payload)`
- send `authorization: Bearer <token>`
- keep the response shape unchanged

- [ ] **Step 4: Re-run the client test**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared sync contract slice**

```bash
git add packages/api-client/src/vault.ts packages/api-client/tests/vault-client.spec.ts
git commit -m "feat: require auth on vault sync client"
```

### Task 2: Add Supabase profile lookup for authenticated sync

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`

- [ ] **Step 1: Write the failing Supabase adapter test**

Add a test like:

```ts
it("finds users_profile by authenticated auth_user_id", async () => {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: "profile-1",
      auth_user_id: "auth-user-1",
      email: "user@example.com",
      locale: "zh-CN",
    },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  const profile = await deps.getUserProfileByAuthUserId("auth-user-1");

  expect(from).toHaveBeenCalledWith("users_profile");
  expect(profile?.id).toBe("profile-1");
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: FAIL because `getUserProfileByAuthUserId` does not exist yet

- [ ] **Step 3: Implement the smallest profile lookup helper**

Implementation notes:
- extend the dependency contract returned by `createSupabaseAuthBootstrapDependencies`
- add a lookup on `users_profile` filtered by `auth_user_id`
- return `null` when the profile does not exist

- [ ] **Step 4: Re-run the adapter test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the profile lookup slice**

```bash
git add apps/api/src/lib/supabase.ts apps/api/tests/supabase-bootstrap.spec.ts
git commit -m "feat: add users profile lookup for vault sync"
```

## Chunk 2: Authenticated vault sync route

### Task 3: Enforce auth and profile context in `POST /vault/sync`

**Files:**
- Modify: `apps/api/src/services/vault-service.ts`
- Modify: `apps/api/src/routes/vault-sync.ts`
- Modify: `apps/api/tests/vault-sync.spec.ts`

- [ ] **Step 1: Write the failing route tests**

Add tests for:

```ts
it("rejects sync without a bearer token", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/vault/sync",
    payload: { changed_items: [] },
  });

  expect(response.statusCode).toBe(401);
  expect(response.json()).toEqual({
    ok: false,
    error: "missing_bearer_token",
  });
});

it("returns profile_not_found when the token has no users_profile", async () => {
  // register route with a stubbed dependency that returns null profile
  expect(response.statusCode).toBe(404);
});
```

Also update the happy-path test so it includes a bearer token and asserts the route still returns:
- `server_time`
- `updated_items`
- `deleted_item_ids`
- `conflicts`

- [ ] **Step 2: Run the vault sync test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-sync.spec.ts`
Expected: FAIL because the route still allows anonymous sync and has no profile lookup behavior

- [ ] **Step 3: Implement the smallest authenticated vault sync route**

Implementation notes:
- create a small route factory like the auth route pattern
- parse `Authorization: Bearer <token>`
- call a dependency that:
  - resolves the Supabase user from token
  - resolves the matching `users_profile`
- map errors to:
  - `401 missing_bearer_token`
  - `401 invalid_token`
  - `404 profile_not_found`
  - `500 sync_failed`
- change `buildVaultSyncPayload()` so it accepts a profile object, even if it does not use it yet

Recommended minimal profile shape:

```ts
type VaultSyncProfile = {
  id: string;
  auth_user_id: string;
  email: string;
  locale: string;
};
```

- [ ] **Step 4: Re-run the vault sync and route smoke tests**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-sync.spec.ts apps/api/tests/routes.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the authenticated route slice**

```bash
git add apps/api/src/services/vault-service.ts apps/api/src/routes/vault-sync.ts apps/api/tests/vault-sync.spec.ts
git commit -m "feat: require auth context for vault sync"
```

### Task 4: Document the new sync precondition and run repo verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Add a short note in the local auth/setup area that:
- `/vault/sync` now requires a bootstrapped authenticated session
- a user must complete the existing auth bootstrap flow before sync succeeds

- [ ] **Step 2: Run focused verification**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/vault-sync.spec.ts`
Expected: PASS

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 3: Commit the docs and verification slice**

```bash
git add README.md
git commit -m "docs: note vault sync auth prerequisite"
```
