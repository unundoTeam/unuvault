# Unuvault Auth Login Entrypoint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal `unuvault` sign-in entry point so existing users can complete hosted auth and local handoff flows without being forced back through register.

**Architecture:** Keep `/register` focused on account creation, add a dedicated `/login` page that shares the same visual shell, and update the handoff unauthenticated state to branch toward login or register while preserving the existing `next` callback contract. Reuse the current `/auth/callback` route and safe-next handling instead of introducing a parallel callback path.

**Tech Stack:** Next.js 16, React 19, Supabase browser auth, Vitest, Testing Library

---

## File Structure

- Create: `apps/web/src/app/login/page.tsx`
  New sign-in page shell that mirrors the register surface and accepts `next`.
- Create: `apps/web/src/components/auth/login-form.tsx`
  Email/password and Google sign-in actions for existing users.
- Create: `apps/web/src/components/auth/auth-next.ts`
  Shared helpers for safe `next` handling and callback URL construction.
- Create: `apps/web/tests/login-page.spec.tsx`
  Focused tests for sign-in behaviors and `next` preservation.
- Modify: `apps/web/src/components/auth/register-form.tsx`
  Add a stable link from register to login and reuse the shared redirect helper.
- Modify: `apps/web/src/app/register/page.tsx`
  Pass `next` through to the register surface and expose login navigation.
- Modify: `apps/web/src/components/dev-secrets/handoff-page-client.tsx`
  Replace register-only unauthenticated UX with login/register branching.
- Modify: `apps/web/tests/dev-secrets-handoff-page.spec.tsx`
  Update unauthenticated expectations for the new branching.
- Modify: `apps/web/tests/register-page.spec.tsx`
  Add coverage for the new login link from register.
- Optionally modify: `apps/web/src/lib/identity/browser.ts`
  Only if the login form needs a small helper export beyond the current browser client factory.

## Chunk 1: Add the dedicated login surface

### Task 1: Write failing tests for the new login page shell

**Files:**
- Create: `apps/web/tests/login-page.spec.tsx`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/components/auth/login-form.tsx`
- Create: `apps/web/src/components/auth/auth-next.ts`

- [ ] **Step 1: Add a failing test that `/login` renders email/password sign-in and Google entry actions**

```tsx
it("shows sign-in actions for existing users", async () => {
  render(await LoginPage({}));

  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a failing test that email/password sign-in preserves the `next` callback path**

```tsx
expect(identitySignInWithPassword).toHaveBeenCalledWith({
  email: "user@example.com",
  password: "correct-horse-battery",
});
expect(assignSpy).toHaveBeenCalledWith("/dev/secrets/handoff?callback=...");
```

- [ ] **Step 3: Add a failing test that Google sign-in calls Supabase with `/auth/callback?next=<encoded-next>`**

```tsx
expect(identitySignInWithOAuth).toHaveBeenCalledWith({
  provider: "google",
  options: {
    redirectTo: expect.stringContaining("/auth/callback?next=%2Fdev%2Fsecrets%2Fhandoff"),
  },
});
```

- [ ] **Step 4: Run the focused login test file and verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/login-page.spec.tsx`
Expected: FAIL because the login page and form do not exist yet.

- [ ] **Step 5: Implement the minimal login page, shared next helper, and form**

Implementation notes:
- keep the page shell visually aligned with `/register`
- keep login and register forms separate
- redirect successful email/password sign-in to the caller-provided `next`, defaulting to `/auth/finalize`
- use Supabase `signInWithOAuth({ provider: "google" })` with `redirectTo=/auth/callback?...`

- [ ] **Step 6: Re-run the focused login test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/login-page.spec.tsx`
Expected: PASS

### Task 2: Add the register-to-login bridge

**Files:**
- Modify: `apps/web/src/components/auth/register-form.tsx`
- Modify: `apps/web/src/app/register/page.tsx`
- Modify: `apps/web/tests/register-page.spec.tsx`

- [ ] **Step 1: Add a failing test that register exposes a `Sign in` link preserving the current `next`**

```tsx
expect(
  screen.getByRole("link", { name: "Sign in" }),
).toHaveAttribute("href", expect.stringContaining("/login?next="));
```

- [ ] **Step 2: Run the register-page test file and verify the new assertion fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/register-page.spec.tsx`
Expected: FAIL because no login link exists yet.

- [ ] **Step 3: Implement the minimal register link using the shared next helper**

Implementation notes:
- do not add mode toggles to the register form
- keep current copy and status handling intact

- [ ] **Step 4: Re-run the register-page test file**

Run: `./node_modules/.bin/vitest --run apps/web/tests/register-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the auth-surface slice**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/components/auth/login-form.tsx apps/web/src/components/auth/auth-next.ts apps/web/src/components/auth/register-form.tsx apps/web/src/app/register/page.tsx apps/web/tests/login-page.spec.tsx apps/web/tests/register-page.spec.tsx
git commit -m "feat: add auth login entrypoint"
```

## Chunk 2: Wire handoff unauthenticated state to the new login path

### Task 3: Update the handoff unauthenticated branch with failing tests first

**Files:**
- Modify: `apps/web/src/components/dev-secrets/handoff-page-client.tsx`
- Modify: `apps/web/tests/dev-secrets-handoff-page.spec.tsx`

- [ ] **Step 1: Add a failing test that unauthenticated handoff offers login and register routes**

```tsx
expect(
  await screen.findByRole("link", { name: "Continue with email" }),
).toHaveAttribute("href", expect.stringContaining("/login?next="));
expect(
  screen.getByRole("link", { name: "Create account" }),
).toHaveAttribute("href", expect.stringContaining("/register?next="));
```

- [ ] **Step 2: Add a failing test that Google auth is offered directly from handoff**

```tsx
expect(
  screen.getByRole("link", { name: "Continue with Google" }),
).toHaveAttribute("href", expect.stringContaining("/login?next="));
```

- [ ] **Step 3: Run the focused handoff test file and verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: FAIL because handoff still renders only `Continue through register`.

- [ ] **Step 4: Implement the minimal handoff branching**

Implementation notes:
- keep the explanatory copy focused on connecting the browser session to the local CLI
- use shared URL builders so register/login stay in sync
- prefer one clear primary action, not a large auth chooser

- [ ] **Step 5: Re-run the handoff test file**

Run: `./node_modules/.bin/vitest --run apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: PASS

### Task 4: Run the focused auth regression suite

**Files:**
- Test: `apps/web/tests/login-page.spec.tsx`
- Test: `apps/web/tests/register-page.spec.tsx`
- Test: `apps/web/tests/dev-secrets-handoff-page.spec.tsx`

- [ ] **Step 1: Run the focused suite covering login, register, and handoff**

Run: `./node_modules/.bin/vitest --run apps/web/tests/login-page.spec.tsx apps/web/tests/register-page.spec.tsx apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run `apps/web` lint**

Run: `corepack pnpm lint --filter ./apps/web`
Expected: PASS

- [ ] **Step 3: Commit the handoff auth-branching slice**

```bash
git add apps/web/src/components/dev-secrets/handoff-page-client.tsx apps/web/tests/dev-secrets-handoff-page.spec.tsx
git commit -m "feat: route handoff auth through login entrypoint"
```

## Chunk 3: Re-run the hosted-smoke-supporting verification

### Task 5: Verify the local hosted flow surfaces are still healthy

**Files:**
- Test: `apps/web/tests/browser-env-source-contract.spec.ts`
- Test: `apps/web/tests/login-page.spec.tsx`
- Test: `apps/web/tests/register-page.spec.tsx`
- Test: `apps/web/tests/dev-secrets-handoff-page.spec.tsx`

- [ ] **Step 1: If the env-helper contract fix is part of this branch, run it alongside the auth tests**

Run: `./node_modules/.bin/vitest --run apps/web/tests/browser-env-source-contract.spec.ts apps/web/tests/login-page.spec.tsx apps/web/tests/register-page.spec.tsx apps/web/tests/dev-secrets-handoff-page.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run `git diff --check`**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Summarize the manual hosted smoke follow-up**

Checklist:
- `provider.sh read --app unundo --env local` opens the handoff page
- unauthenticated handoff offers Google, email login, and register
- an existing user can sign in without re-registering
- browser session returns to the handoff route and can proceed to CLI callback
