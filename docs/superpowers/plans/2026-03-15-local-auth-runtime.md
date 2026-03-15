# Local Auth Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Supabase-backed MVP auth flow runnable locally through a real browser page and a real API server.

**Architecture:** Keep the product flow unchanged and only add runtime plumbing. `apps/web` becomes a minimal Next app with a valid app shell and dev scripts, while `apps/api` gets a dedicated Fastify server entrypoint that loads local env and starts listening for `/auth/bootstrap`.

**Tech Stack:** Next.js, React, TypeScript, Fastify, Supabase Auth, dotenv, tsx, Vitest, Testing Library

---

## File Structure

- Modify: `package.json`
  Add shared runtime dependencies plus root convenience scripts for local web/API startup.
- Modify: `.gitignore`
  Ignore local auth runtime artifacts such as `.env.local` and `.next/`.
- Modify: `apps/web/package.json`
  Add `dev`, `build`, and `start` scripts for the Next runtime.
- Modify: `apps/web/tsconfig.json`
  Include Next-specific type files and generated types.
- Create: `apps/web/next-env.d.ts`
  Provide the standard Next type surface in source control.
- Create: `apps/web/src/app/layout.tsx`
  Minimal root layout required by the App Router.
- Create: `apps/web/src/app/page.tsx`
  Simple landing page that points developers toward the register flow.
- Create: `apps/web/tests/home-page.spec.tsx`
  Covers the new app shell and root landing copy.
- Modify: `apps/web/.env.example`
  Document the final local port and public runtime values.
- Modify: `apps/api/package.json`
  Add `dev` and `start` scripts for the Fastify runtime.
- Create: `apps/api/src/server-runtime.ts`
  Pure runtime helper that reads config and starts the app.
- Create: `apps/api/src/server.ts`
  CLI entrypoint for `tsx` that loads env and launches the Fastify app.
- Create: `apps/api/tests/server-runtime.spec.ts`
  Covers default host/port behavior and startup wiring.
- Modify: `apps/api/.env.example`
  Document the final local server env contract, including `PORT`.
- Modify: `README.md`
  Explain how to create local env files and run the two-process auth loop.

## Chunk 1: Web runtime surface

### Task 1: Add the Next runtime dependencies and package scripts

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Capture the current missing-runtime failure**

Run: `./node_modules/.bin/pnpm --filter @unuvault/web dev`  
Expected: FAIL with a missing `dev` script

- [ ] **Step 2: Add the minimal web runtime dependencies and scripts**

Implementation notes:
- add `next` to the root `devDependencies`
- add root convenience script `dev:web`
- add `dev`, `build`, and `start` scripts to `apps/web/package.json`
- run the web runtime on port `3001` so the existing API base URL can stay on `3000`

```json
{
  "scripts": {
    "dev:web": "pnpm --filter @unuvault/web dev"
  },
  "devDependencies": {
    "next": "^16.0.0"
  }
}
```

- [ ] **Step 3: Re-run the command to see the next expected failure**

Run: `./node_modules/.bin/pnpm --filter @unuvault/web dev`  
Expected: FAIL because the Next app shell is still incomplete

- [ ] **Step 4: Commit the web runtime dependency slice**

```bash
git add package.json pnpm-lock.yaml apps/web/package.json
git commit -m "chore: add web runtime dependencies"
```

### Task 2: Add the minimal Next app shell

**Files:**
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/tests/home-page.spec.tsx`

- [ ] **Step 1: Write the failing web shell test**

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "../src/app/page";

it("points local developers to the register flow", () => {
  render(<HomePage />);

  expect(screen.getByText("Run unuvault locally")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open register flow" })).toHaveAttribute(
    "href",
    "/register",
  );
});
```

- [ ] **Step 2: Run the failing web shell test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/home-page.spec.tsx`  
Expected: FAIL because `src/app/page.tsx` does not exist yet

- [ ] **Step 3: Add the smallest valid Next app shell**

Implementation notes:
- create a root layout with `<html lang="en">`
- create a root page that explains the local auth loop and links to `/register`
- add `next-env.d.ts`
- update `apps/web/tsconfig.json` to include `next-env.d.ts` and `.next/types/**/*.ts`

- [ ] **Step 4: Re-run the web shell and existing register tests**

Run: `./node_modules/.bin/vitest --run apps/web/tests/home-page.spec.tsx apps/web/tests/register-page.spec.tsx`  
Expected: PASS

- [ ] **Step 5: Commit the app-shell slice**

```bash
git add apps/web/tsconfig.json apps/web/next-env.d.ts apps/web/src/app/layout.tsx apps/web/src/app/page.tsx apps/web/tests/home-page.spec.tsx
git commit -m "feat: add next app shell for local auth"
```

## Chunk 2: API runtime surface

### Task 3: Add the API server entrypoint and runtime scripts

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/server-runtime.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/tests/server-runtime.spec.ts`

- [ ] **Step 1: Write the failing API runtime test**

```ts
import { describe, expect, it, vi } from "vitest";
import { startApiServer } from "../src/server-runtime";

describe("startApiServer", () => {
  it("starts the Fastify app on localhost:3000 by default", async () => {
    const listen = vi.fn().mockResolvedValue("http://127.0.0.1:3000");
    const logger = { info: vi.fn() };

    await startApiServer({ listen } as never, {}, logger as never);

    expect(listen).toHaveBeenCalledWith({ host: "127.0.0.1", port: 3000 });
    expect(logger.info).toHaveBeenCalledWith(
      "API listening at http://127.0.0.1:3000",
    );
  });
});
```

- [ ] **Step 2: Run the failing API runtime test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/server-runtime.spec.ts`  
Expected: FAIL because `src/server-runtime.ts` does not exist yet

- [ ] **Step 3: Add the smallest startable API runtime**

Implementation notes:
- add `tsx` and `dotenv` to the root `devDependencies`
- add root convenience script `dev:api`
- use `DOTENV_CONFIG_PATH=.env.local` in the API package scripts
- keep `server-runtime.ts` pure enough to unit test host/port defaults
- make `server.ts` import `"dotenv/config"` and call `startApiServer(app)`

```ts
export async function startApiServer(server: FastifyListenLike, env = process.env, logger = console) {
  const port = Number.parseInt(env.PORT ?? "3000", 10);
  const host = env.HOST ?? "127.0.0.1";
  const address = await server.listen({ host, port });
  logger.info(`API listening at ${address}`);
}
```

- [ ] **Step 4: Re-run the API runtime test and API auth smoke**

Run: `./node_modules/.bin/vitest --run apps/api/tests/server-runtime.spec.ts apps/api/tests/auth-bootstrap.spec.ts apps/api/tests/routes.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit the API runtime slice**

```bash
git add package.json pnpm-lock.yaml apps/api/package.json apps/api/src/server-runtime.ts apps/api/src/server.ts apps/api/tests/server-runtime.spec.ts
git commit -m "feat: add local api runtime entrypoint"
```

## Chunk 3: Local env safety, docs, and live verification

### Task 4: Protect local env artifacts and document the runtime loop

**Files:**
- Modify: `.gitignore`
- Modify: `apps/web/.env.example`
- Modify: `apps/api/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add ignore rules for local runtime artifacts**

Rules to add:
- `.env.local`
- `.next/`

- [ ] **Step 2: Update env examples with the final local contract**

Required values:
- `apps/web/.env.example`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000`
- `apps/api/.env.example`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `PORT=3000`

- [ ] **Step 3: Add README instructions for the two-terminal local loop**

Required sections:
- copy `.env.example` to `.env.local` in `apps/web` and `apps/api`
- run `pnpm dev:api`
- run `pnpm dev:web`
- open `http://127.0.0.1:3001/register`

- [ ] **Step 4: Re-run lint and JS tests**

Run: `bash scripts/testing/lint-runner.sh`  
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`  
Expected: PASS

- [ ] **Step 5: Commit the local runtime docs slice**

```bash
git add .gitignore apps/web/.env.example apps/api/.env.example README.md
git commit -m "docs: add local auth runtime setup"
```

### Task 5: Run the live Supabase smoke loop without committing secrets

**Files:**
- Create locally only: `apps/web/.env.local`
- Create locally only: `apps/api/.env.local`

- [ ] **Step 1: Create local env files from the examples**

`apps/web/.env.local`
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

`apps/api/.env.local`
```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PORT=3000
```

- [ ] **Step 2: Start the API runtime**

Run: `./node_modules/.bin/pnpm dev:api`  
Expected: server log contains `API listening at http://127.0.0.1:3000`

- [ ] **Step 3: Start the web runtime in a second terminal**

Run: `./node_modules/.bin/pnpm dev:web`  
Expected: Next reports it is ready on `http://localhost:3001`

- [ ] **Step 4: Verify the local register page loads**

Run: `curl -s http://127.0.0.1:3001/register | grep "Create your unuvault account"`  
Expected: finds the heading in the rendered HTML

- [ ] **Step 5: Complete a real signup/bootstrap verification**

Verification target:
- open `http://127.0.0.1:3001/register`
- submit a fresh email/password
- observe the `Account ready` state after Supabase signup and API bootstrap

- [ ] **Step 6: Confirm secrets stay untracked**

Run: `git status --short --branch`  
Expected: clean branch state with `.env.local` ignored
