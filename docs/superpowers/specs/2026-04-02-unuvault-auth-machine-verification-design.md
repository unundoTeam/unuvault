# Unuvault Auth Machine Verification Design

**Problem:** `unuvault` already documents a three-layer auth boundary and already
has focused Web, API, and browser-extension auth tests. What the repo still
does not have is one explicit root-level machine guard that says these docs and
these surface-owned tests are the required proof for the same canonical auth
contract.

## Current State

- [`README.md`](../../../README.md) already defines the canonical auth boundary
  across Web, API, and browser-extension surfaces.
- [`docs/architecture/0002-supabase-boundary.md`](../../../docs/architecture/0002-supabase-boundary.md)
  already names the three layers: shared identity authority, product identity
  bridge, and product runtime.
- [`apps/web/tests/auth-callback-route.spec.ts`](../../../apps/web/tests/auth-callback-route.spec.ts),
  [`apps/web/tests/finalize-page.spec.tsx`](../../../apps/web/tests/finalize-page.spec.tsx),
  and
  [`apps/web/tests/bootstrap-unuvault-profile.spec.ts`](../../../apps/web/tests/bootstrap-unuvault-profile.spec.ts)
  already prove the Web callback, finalize, and bootstrap path.
- [`apps/api/tests/auth-default-route.spec.ts`](../../../apps/api/tests/auth-default-route.spec.ts)
  and
  [`apps/api/tests/auth-bootstrap.spec.ts`](../../../apps/api/tests/auth-bootstrap.spec.ts)
  already prove `POST /auth/bootstrap` is the bearer-token product bridge.
- [`apps/browser-extension/tests/background-auth.spec.ts`](../../../apps/browser-extension/tests/background-auth.spec.ts)
  already proves extension `signed_in` exists only after bootstrap succeeds.

So the repo already has the right behavior and the right docs. The missing
piece is an explicit root-level machine verification slice that binds them
together.

## Approaches

### Option 1: Keep relying on transitive package tests only

- Continue treating `pnpm test` as sufficient because it already reaches the
  relevant Web/API/browser-extension test files.

Trade-off:

- This keeps the runtime proof, but it does not make the repo-level auth
  contract explicit.
- Contributors still have to infer which files collectively define the auth
  boundary.

### Option 2: Add a root auth-boundary contract test that pins docs, entrypoints, and owning proof surfaces (Recommended)

- Add a root `tests/auth-boundary-contract.spec.ts`.
- Make it assert the canonical auth docs still describe the same boundary.
- Make it assert the Web/API/browser-extension packages keep stable `vitest`
  test entrypoints.
- Make it assert the key surface-owned auth tests still cover callback,
  bootstrap, bearer-token, and bootstrap-backed `signed_in` semantics.

Why this is recommended:

- It matches the repo's existing root meta-test style in
  `tests/workspace-entrypoints.spec.ts` and `tests/unuforge-entrypoints.spec.ts`.
- It strengthens the repo contract without inventing a new workflow tier.
- It keeps the owning runtime proof in the owning surfaces while giving the
  repo one explicit machine gate for the cross-surface auth story.

### Option 3: Add a new dedicated CI workflow for auth only

- Create a separate workflow or script that runs a custom auth verification
  subset.

Trade-off:

- Stronger on paper, but heavier than needed for the current repo state.
- The repo already has `pnpm test`; the gap is contract visibility, not missing
  automation infrastructure.

## Chosen Design

Use option 2 and add one root auth-boundary contract guard.

### Guard responsibilities

The new root guard should pin three things:

1. **Repo authority docs**
   - the root README still names the canonical auth boundary
   - the Supabase boundary ADR still names the same three layers
   - both docs explicitly point at the root auth machine guard

2. **Owning package test entrypoints**
   - `@unuvault/web`, `@unuvault/api`, and `@unuvault/browser-extension`
     continue to expose `vitest --run tests`
   - this preserves the meaning of root `pnpm test`

3. **Owning proof surfaces**
   - Web: callback -> finalize -> bootstrap
   - API: bearer-token bridge at `POST /auth/bootstrap`
   - browser-extension: bootstrap-backed `signed_in`

### Docs change

This slice should make the machine guard explicit in both authority docs:

- [`README.md`](../../../README.md) should say the repo-level auth machine
  verification guard lives in `tests/auth-boundary-contract.spec.ts`
- [`docs/architecture/0002-supabase-boundary.md`](../../../docs/architecture/0002-supabase-boundary.md)
  should say the same from the architecture side

### Verification strategy

The slice should verify in two steps:

1. Focused red/green on `tests/auth-boundary-contract.spec.ts`
2. Standard repo verification with:
   - `pnpm lint`
   - `pnpm test`

## Out Of Scope

- runtime auth refactors in Web, API, or browser-extension
- new auth-only CI workflows
- iOS auth implementation
- changes to `/auth/bootstrap` behavior itself

## Acceptance Criteria

- `tests/auth-boundary-contract.spec.ts` exists and passes
- root docs explicitly name that guard as the repo-level auth machine
  verification slice
- root `pnpm test` continues to cover the auth-owning workspaces through stable
  package test entrypoints
