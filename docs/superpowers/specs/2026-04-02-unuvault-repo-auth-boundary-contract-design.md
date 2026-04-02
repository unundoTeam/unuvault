# Unuvault Repo Auth Boundary Contract Design

**Problem:** `unuvault` already behaves like a three-layer auth system, but the repo does not yet state that boundary as one explicit, contributor-facing contract. Today the Web app, API, and browser extension each encode the right pieces in code and tests, yet the repo-level docs still describe the split at two different abstraction levels: the README explains the local auth loop, while the Supabase boundary doc explains ownership. What is still missing is one clear repo contract that says who authenticates the user, which API call establishes product identity, and how each surface is expected to consume that bridge.

## Current State

- [`README.md`](../../../README.md) correctly says `unuidentity` owns shared identity and documents the local Web auth loop as `signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`.
- [`docs/architecture/0002-supabase-boundary.md`](../../../docs/architecture/0002-supabase-boundary.md) correctly says Supabase Auth owns primary authentication and the TypeScript API owns product logic.
- [`apps/web/tests/finalize-page.spec.tsx`](../../../apps/web/tests/finalize-page.spec.tsx) proves the Web surface only proceeds after `bootstrapUnuvaultProfile()` succeeds.
- [`apps/api/tests/auth-default-route.spec.ts`](../../../apps/api/tests/auth-default-route.spec.ts) and [`apps/api/tests/auth-bootstrap.spec.ts`](../../../apps/api/tests/auth-bootstrap.spec.ts) prove `POST /auth/bootstrap` is the bearer-token product bridge.
- [`apps/browser-extension/tests/background-auth.spec.ts`](../../../apps/browser-extension/tests/background-auth.spec.ts) now proves extension `signed_in` only exists after `bootstrapProfile()` succeeds.

So the codebase already has the right behavior. The gap is that the repo still lacks one explicit contract tying those surfaces together.

## Approaches

### Option 1: Update the README only

- Add a short auth-boundary paragraph to the root README and leave the architecture doc unchanged.

Trade-off:

- Lowest effort, but it would keep the repo split between a contributor overview and an architecture note that still speaks more generally.
- Future contributors could still read the architecture doc and miss the cross-surface bridge semantics we want to preserve.

### Option 2: Update the README and the architecture boundary doc, then verify against existing focused tests (Recommended)

- Tighten the README so it describes the canonical auth boundary in repo-facing language.
- Expand the Supabase boundary doc so it names the three layers explicitly:
  - shared identity authority
  - product bridge
  - product runtime
- Use the existing focused Web/API/extension auth tests as the verification shell for this docs-and-contract slice.

Why this is recommended:

- It creates one stable story without inventing a new testing framework.
- It keeps the authority docs small and close to the code that already proves the behavior.
- It matches how `unuvault` already works: the behavior is already right; the repo contract just needs to catch up.

### Option 3: Introduce a brand-new cross-surface auth contract test

- Add a new repo-level test or CI script that attempts to encode the README/architecture contract directly.

Trade-off:

- This sounds stronger, but it would add a new enforcement shape that the repo does not currently use for docs-level contracts.
- It risks creating a brittle meta-test when the real runtime tests already exist in the owning surfaces.

## Chosen Design

Use option 2 and make the repo-level auth contract explicit in the two authority docs that contributors already read first.

### Contract

The repo should describe `unuvault` auth as three layers:

1. **Shared identity authority**
   - owned by `unuidentity` and Supabase Auth
   - authenticates the person and returns an identity session

2. **Product bridge**
   - owned by `unuvault` API at `POST /auth/bootstrap`
   - converts a valid identity bearer token into a `users_profile`-backed product identity

3. **Product runtime**
   - owned by `unuvault` API routes such as `/vault/sync`
   - consumes bearer tokens only after the product bridge is in place

This contract should also make the surface responsibilities explicit:

- Web:
  - `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`
- Browser extension:
  - extension identity sign-in -> `POST /auth/bootstrap` -> background `signed_in`
- API:
  - `POST /auth/bootstrap` is the canonical product identity bridge
  - product routes like `/vault/sync` are downstream runtime consumers
- iOS:
  - remains repo-owned, but is out of scope for this slice and should follow the same bridge model once its auth surface becomes real

### README changes

[`README.md`](../../../README.md) should continue to be the contributor-facing entrypoint, but it needs one clearer auth-boundary section.

That section should:

- say that `unuidentity` authenticates the user
- say that `POST /auth/bootstrap` establishes product identity inside `unuvault`
- say that Web and extension are clients of the same bridge, even though their entry paths differ
- avoid implying that `/auth/finalize` is the authority by itself

### Architecture doc changes

[`docs/architecture/0002-supabase-boundary.md`](../../../docs/architecture/0002-supabase-boundary.md) should move from a general “Supabase vs TypeScript API” split to a more explicit auth boundary.

It should clarify:

- Supabase Auth is primary identity authority, not product identity authority
- `POST /auth/bootstrap` is the product identity bridge
- product routes such as vault sync, import flows, and device surfaces consume that bridge rather than replacing it
- browser extension, Web, and future iPhone surfaces should talk to product APIs or typed clients after bootstrap

### Verification strategy

This slice should **not** add a new repo-level meta-test. Instead, it should verify the repo contract against the existing focused auth tests that already own the behavior:

- Web finalization and bootstrap:
  - [`apps/web/tests/finalize-page.spec.tsx`](../../../apps/web/tests/finalize-page.spec.tsx)
- API bootstrap bridge:
  - [`apps/api/tests/auth-default-route.spec.ts`](../../../apps/api/tests/auth-default-route.spec.ts)
  - [`apps/api/tests/auth-bootstrap.spec.ts`](../../../apps/api/tests/auth-bootstrap.spec.ts)
- Extension signed-in contract:
  - [`apps/browser-extension/tests/background-auth.spec.ts`](../../../apps/browser-extension/tests/background-auth.spec.ts)

This keeps verification aligned with the actual runtime owners and avoids introducing a docs-only testing abstraction.

## Out Of Scope

- Web auth flow refactors
- API runtime changes to `/auth/bootstrap` or `/vault/sync`
- extension popup/UI wording changes
- iOS auth implementation
- new CI frameworks or docs-only contract scripts

## Acceptance Criteria

- the root README states the canonical auth boundary in one clear contributor-facing place
- the Supabase boundary architecture doc states the same contract in architecture language
- both docs agree that `POST /auth/bootstrap` is the product identity bridge
- the focused Web/API/extension auth tests still pass after the docs changes
