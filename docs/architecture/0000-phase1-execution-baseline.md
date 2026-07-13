# unuvault Phase 1 Execution Baseline

## Purpose

This document resolves overlap between the phase-1 design spec and the two
execution plans created on March 14, 2026. It also records which parts of that
planned baseline remain current after implementation moved to a personal,
local-first, Mac-first posture.

## Product Name

- Canonical product name: `unuvault`
- Do not use legacy aliases from earlier planning drafts.

## Source-of-Truth Order

1. Current product ownership, contributor entrypoints, verification, and
   contract posture come from the root `README.md`.
2. Current local-first product layering comes from
   `docs/architecture/0008-personal-local-first-product-split.md`.
3. Current workspace manifests, `pnpm-lock.yaml`, and checked-in runtime source
   define the implemented stack.
4. `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
   and `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`
   remain historical scope and sequencing context.
5. `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1.md`
   remains a reference draft only.

## Why This Is The Baseline

- The design spec and the earlier implementation plan were both created at `2026-03-14 13:47:53 +0800`.
- The roadmap was created later at `2026-03-14 15:12:05 +0800`.
- The roadmap also contains the more complete engineering picture: workspace manifests, package boundaries, Supabase boundary, API client package, and launch docs.

## Resolved Decisions

### Product Baseline

- Use Bitwarden as the functional baseline and reference architecture for vault behavior, crypto expectations, and password-manager UX patterns.
- Keep the phase-1 password-only and personal-user boundary, but apply the
  current local-first split: Mac local vault, browser fill, Web management, and
  iPhone receive/view come before optional Cloud and Sync expansion.

### Optional Cloud and Sync Infrastructure Baseline

- For the optional Cloud and Sync layer, use Supabase for Auth and Postgres as
  the initial managed backend foundation. Neither is a dependency of the local
  Mac vault, browser-fill, or iPhone receive/view core.
- Keep Cloud and Sync vault business logic in the product's TypeScript API
  layer instead of pushing domain logic into Supabase directly.

### Current Implemented Tech Stack

- Workspace: pnpm monorepo
- Optional Cloud and Sync backend: Node.js, TypeScript, Fastify, PostgreSQL,
  Supabase JavaScript client
- Web: Next.js, React, repo-local CSS
- Browser extension: TypeScript, React, esbuild, generated Manifest V3 assets
- iPhone: SwiftUI
- Mac companion: SwiftUI and Swift Package Manager
- Testing: Vitest, XCTest, and repo-owned native/browser smoke harnesses

The March 2026 roadmap named Drizzle, Tailwind CSS, WXT, and Playwright as
planned framework choices. They are not declared as direct, active dependencies
in the current workspace manifests and are not requirements for the implemented
runtime. A lockfile reference that exists only as optional or transitive peer
metadata is not evidence of active adoption. Future adoption of any of these
tools requires a deliberate implementation decision; historical plan references
must not be read as proof that they are part of the current stack.

### Canonical Workspace Layout

- `apps/api`
- `apps/web`
- `apps/browser-extension`
- `apps/ios`
- `packages/domain`
- `packages/security`
- `packages/api-client`
- `infra/supabase`
- `docs/architecture`
- `docs/launch`

### Canonical Implementation Conventions

- Prefer current manifests and checked-in runtime source over unimplemented
  framework choices in historical plans.
- Web routes should follow the Next.js App Router structure shown in the roadmap, such as `apps/web/src/app/security/page.tsx`, not the earlier generic `src/routes` layout.
- API route groups should follow the roadmap naming: `/auth`, `/vault`, `/devices`, `/imports`, and `/activity`.
- Browser import should live under `/imports/browser`.
- Shared client access for web and extension should live in `packages/api-client`.

### Historical Milestone Sequence

The March 2026 milestone order is retained for traceability only. Current
delivery order is controlled by
`docs/architecture/0008-personal-local-first-product-split.md` and the root
`README.md`; new work must not treat this historical sequence as canonical.

1. Milestone M1: workspace, schema boundary, and client-side security model
2. Milestone M2: API skeleton and web trust shell
3. Milestone M3: browser daily-use loop and shared sync contract
4. Milestone M4: migration flow, iPhone credibility, and launch trust loop

## Current Implementation Status

- The M1 workspace, schema, and shared security skeleton exists.
- Web vault management, the browser-extension fill path, and the Mac local
  vault have active implementations and repo-owned tests.
- Repo-level iOS code and XCTest prove pairing can locally open and persist a
  claimant-key-bound handoff, while its read-only list model can project
  metadata from the encrypted received-vault store. Physical-device execution
  of those paths is not proved, and the default app-start loader remains
  unimplemented.
- Devices, recent activity, and browser import still contain scaffold-level
  surfaces and require dedicated product slices before they are described as
  complete workflows.

New work should start from the root README, the current architecture decisions,
and a current dated implementation plan rather than replaying the original M1
bootstrap steps.
