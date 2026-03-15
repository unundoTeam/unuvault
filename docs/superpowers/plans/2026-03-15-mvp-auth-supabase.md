# MVP Auth with Supabase Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `unuvault` auth from placeholders into a web-only MVP signup flow that creates a Supabase account, bootstraps `users_profile`, and returns a product profile from the TypeScript API.

**Architecture:** Keep `Supabase Auth` as the authentication source of truth while adding a thin `POST /auth/bootstrap` API route that verifies the authenticated user and upserts `users_profile`. The web app owns the first register form and calls Supabase directly for signup, then calls the API through a typed client helper to complete product bootstrap.

**Tech Stack:** Next.js, React, TypeScript, Fastify, Supabase Auth, Supabase Data API, Vitest, Testing Library

---

## File Structure

- Modify: `package.json`
  Add the Supabase client dependency needed by the web app and API.
- Create: `packages/api-client/src/auth.ts`
  Typed helper for the product bootstrap request.
- Create: `packages/api-client/tests/auth-client.spec.ts`
  Covers the auth bootstrap request contract.
- Create: `apps/api/src/lib/supabase.ts`
  Centralized server-side Supabase client creation and token/profile helpers.
- Create: `apps/api/src/services/auth-bootstrap-service.ts`
  Pure service boundary that validates the authenticated user and upserts `users_profile`.
- Modify: `apps/api/src/routes/auth.ts`
  Replace the placeholder route with bootstrap behavior while preserving a simple group root.
- Create: `apps/api/tests/auth-bootstrap.spec.ts`
  Route/service tests for success, unauthorized access, and idempotent bootstrap.
- Create: `apps/web/src/lib/supabase-browser.ts`
  Browser-side Supabase client setup.
- Create: `apps/web/src/components/auth/register-form.tsx`
  Client component for the register form and flow state.
- Modify: `apps/web/src/app/register/page.tsx`
  Render the real register form instead of static marketing-only copy.
- Create: `apps/web/tests/register-page.spec.tsx`
  Covers the rendered form, success path, and visible error handling.
- Create: `apps/api/.env.example`
  Documents required API-side Supabase variables.
- Create: `apps/web/.env.example`
  Documents required web-side Supabase variables.
- Modify: `README.md`
  Adds the local auth setup note for the new Supabase-backed flow.

## Chunk 1: Shared contract and API bootstrap

### Task 1: Add the auth bootstrap client contract

**Files:**
- Modify: `package.json`
- Create: `packages/api-client/src/auth.ts`
- Create: `packages/api-client/tests/auth-client.spec.ts`

- [ ] **Step 1: Write the failing API client test**

```ts
import { describe, expect, it, vi } from "vitest";
import { bootstrapProfile } from "../src/auth";

describe("bootstrapProfile", () => {
  it("posts to /auth/bootstrap with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({ profile: { email: "user@example.com" } }),
    });

    await bootstrapProfile(fetcher, "jwt-token");

    expect(fetcher).toHaveBeenCalledWith("/auth/bootstrap", {
      method: "POST",
      headers: {
        authorization: "Bearer jwt-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
  });
});
```

- [ ] **Step 2: Run the new client test to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/auth-client.spec.ts`  
Expected: FAIL because `../src/auth` does not exist yet

- [ ] **Step 3: Add the minimal client helper and dependency wiring**

```ts
export type BootstrapProfileResponse = {
  profile: {
    id: string;
    email: string;
    locale: string;
  };
};

export async function bootstrapProfile(fetcher: Fetcher, token: string) {
  const response = await fetcher("/auth/bootstrap", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  return response.json();
}
```

- [ ] **Step 4: Re-run the client test**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/auth-client.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit the shared contract slice**

```bash
git add package.json packages/api-client/src/auth.ts packages/api-client/tests/auth-client.spec.ts
git commit -m "feat: add auth bootstrap client contract"
```

### Task 2: Add the API bootstrap service and route

**Files:**
- Create: `apps/api/src/lib/supabase.ts`
- Create: `apps/api/src/services/auth-bootstrap-service.ts`
- Modify: `apps/api/src/routes/auth.ts`
- Create: `apps/api/tests/auth-bootstrap.spec.ts`
- Modify: `apps/api/tests/routes.spec.ts`

- [ ] **Step 1: Write failing API tests for bootstrap success and 401 handling**

```ts
it("bootstraps a profile for a valid bearer token", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/bootstrap",
    headers: { authorization: "Bearer test-token" },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().profile.email).toBe("user@example.com");
});

it("rejects missing bearer auth", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/bootstrap",
  });

  expect(response.statusCode).toBe(401);
});
```

- [ ] **Step 2: Run the API auth test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/auth-bootstrap.spec.ts`  
Expected: FAIL because the route and service do not exist yet

- [ ] **Step 3: Implement the smallest service boundary**

Implementation notes:
- create a server-side Supabase helper that reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- expose a function that resolves `auth.getUser(token)`
- expose a function that upserts `users_profile` via the Supabase Data API
- keep the route thin by delegating to `auth-bootstrap-service.ts`

```ts
export async function bootstrapProfileFromToken(token: string) {
  const user = await getSupabaseUser(token);
  const profile = await upsertUserProfile({
    auth_user_id: user.id,
    email: user.email ?? "",
    locale: "zh-CN",
  });

  return { profile };
}
```

- [ ] **Step 4: Re-run API auth tests and the route-group smoke test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/routes.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit the API bootstrap slice**

```bash
git add apps/api/src/lib/supabase.ts apps/api/src/services/auth-bootstrap-service.ts apps/api/src/routes/auth.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/routes.spec.ts
git commit -m "feat: add auth bootstrap api route"
```

## Chunk 2: Web registration flow and environment docs

### Task 3: Build the web register form around Supabase Auth

**Files:**
- Create: `apps/web/src/lib/supabase-browser.ts`
- Create: `apps/web/src/components/auth/register-form.tsx`
- Modify: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/tests/register-page.spec.tsx`

- [ ] **Step 1: Write the failing web test**

```tsx
it("submits signup and shows a ready state after bootstrap", async () => {
  render(<RegisterPage />);

  await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("Account ready")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the web test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/register-page.spec.tsx`  
Expected: FAIL because the form and flow do not exist yet

- [ ] **Step 3: Implement the minimal register flow**

Implementation notes:
- make `register-form.tsx` a client component
- use `createClient` from `@supabase/supabase-js`
- call `signUp({ email, password })`
- if a session is returned, call `bootstrapProfile`
- show three states: idle, submitting, ready/error
- keep fields to `email` and `password` only

- [ ] **Step 4: Re-run the web register test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/register-page.spec.tsx`  
Expected: PASS

- [ ] **Step 5: Commit the web register slice**

```bash
git add apps/web/src/lib/supabase-browser.ts apps/web/src/components/auth/register-form.tsx apps/web/src/app/register/page.tsx apps/web/tests/register-page.spec.tsx
git commit -m "feat: add web supabase register flow"
```

### Task 4: Add environment docs and full-slice verification

**Files:**
- Create: `apps/api/.env.example`
- Create: `apps/web/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Document the required env variables**

Required keys:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

- [ ] **Step 2: Add a short README note for local MVP auth setup**

Document:
- where the Supabase project values come from
- which values belong only on the server
- the order to test: register -> bootstrap -> API smoke

- [ ] **Step 3: Run the focused auth verification**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/auth-client.spec.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/routes.spec.ts apps/web/tests/register-page.spec.tsx`  
Expected: PASS

- [ ] **Step 4: Run repository-level wrappers**

Run: `bash scripts/testing/lint-runner.sh`  
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`  
Expected: PASS

- [ ] **Step 5: Commit the docs and verification slice**

```bash
git add apps/api/.env.example apps/web/.env.example README.md
git commit -m "docs: add mvp auth setup guidance"
```
