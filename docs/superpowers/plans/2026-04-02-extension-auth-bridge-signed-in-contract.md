# Extension Auth Bridge Signed-In Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser extension's `signed_in` state explicitly mean "identity sign-in succeeded and `/auth/bootstrap` completed successfully," then guard that invariant with focused tests.

**Architecture:** Keep the current extension auth flow and storage shape, but harden the background runtime as the canonical contract owner. Write failing tests first for the bootstrap-failure path, then make the runtime semantics explicit so storage is only built and written from a successfully bootstrapped profile payload.

**Tech Stack:** TypeScript, Vitest, browser-extension background runtime, Supabase auth, `@unuvault/api-client`

---

## File Structure

- Modify: `apps/browser-extension/src/background/auth.ts`
  Make the bootstrapped `signed_in` contract explicit in the runtime flow.
- Modify: `apps/browser-extension/tests/background-auth.spec.ts`
  Add focused regression coverage for bootstrap failure and persisted-state invariants.

## Chunk 1: Lock the contract with failing tests first

### Task 1: Add negative-path auth tests for bootstrap-gated `signed_in`

**Files:**
- Modify: `apps/browser-extension/tests/background-auth.spec.ts`
- Modify: `apps/browser-extension/src/background/auth.ts`

- [ ] **Step 1: Add a failing test that bootstrap failure leaves the extension signed out**

```ts
it("does not persist signed-in state when bootstrapProfile fails", async () => {
  const runtime = createExtensionAuthRuntime({
    bootstrapProfile: vi.fn().mockRejectedValue(new Error("bootstrap failed")),
    createApiFetch: () => vi.fn(),
    createSupabaseClient: () => ({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "jwt-token" },
            user: { email: "user@example.com" },
          },
          error: null,
        }),
      },
    }),
    now: () => "2026-04-02T00:00:00.000Z",
    readStoredAuthState,
    clearStoredAuthState,
    writeStoredAuthState,
  });

  await expect(
    runtime.signInWithPassword({
      email: "user@example.com",
      password: "correct horse",
    }),
  ).rejects.toThrow("bootstrap failed");
  await expect(readStoredAuthState()).resolves.toBeNull();
});
```

- [ ] **Step 2: Add a failing test that missing access token also leaves storage signed out**

```ts
await expect(
  runtime.signInWithPassword({
    email: "user@example.com",
    password: "correct horse",
  }),
).rejects.toThrow("missing access token");
await expect(readStoredAuthState()).resolves.toBeNull();
```

- [ ] **Step 3: Run the focused background auth test file and verify at least one new assertion fails**

Run: `./node_modules/.bin/pnpm --filter @unuvault/browser-extension test -- --run tests/background-auth.spec.ts`
Expected: FAIL because the new contract assertions are not fully expressed in the current tests/runtime structure yet.

- [ ] **Step 4: Make the smallest runtime change needed to express the contract explicitly**

Implementation notes:
- keep the storage payload shape unchanged
- keep `signInWithPassword` as the only place that creates persisted auth state
- make the code path read clearly as `identity auth -> token check -> bootstrap -> build persisted state -> write storage -> return signed_in`
- do not add popup, API, or token-refresh behavior

- [ ] **Step 5: Re-run the focused background auth test file**

Run: `./node_modules/.bin/pnpm --filter @unuvault/browser-extension test -- --run tests/background-auth.spec.ts`
Expected: PASS

## Chunk 2: Regress the extension auth contract through the existing verification entrypoints

### Task 2: Re-run browser-extension verification

**Files:**
- Test: `apps/browser-extension/tests/background-auth.spec.ts`
- Test: `apps/browser-extension/tests/popup.spec.tsx`
- Test: `apps/browser-extension/tests/packaging-build.spec.ts`

- [ ] **Step 1: Run the full browser-extension test target**

Run: `./node_modules/.bin/pnpm --filter @unuvault/browser-extension test`
Expected: PASS

- [ ] **Step 2: Run the repo verification entrypoint that already covers browser-extension tests**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 3: Run `git diff --check`**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Commit the contract hardening slice**

```bash
git add apps/browser-extension/src/background/auth.ts apps/browser-extension/tests/background-auth.spec.ts
git commit -m "refactor: harden extension signed-in auth contract"
```

## Notes For Execution

- Keep this slice background-runtime-only even if popup tests mention `signed_in`.
- If the focused negative-path tests already pass before any code change, still make the contract more explicit in `auth.ts` so the invariant is easy to read and harder to regress.
- Do not change `apps/api` or `apps/web` in this plan.
