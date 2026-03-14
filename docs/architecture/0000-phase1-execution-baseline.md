# Blackbox (黑匣子) Phase 1 Execution Baseline

## Purpose

This document resolves overlap between the phase-1 design spec and the two execution plans created on March 14, 2026. It defines the single source of truth to use when product, architecture, or sequencing questions come up during implementation.

## Product Name

- Working product name: `Blackbox`
- Chinese name: `黑匣子`
- Treat both names as referring to the same phase-1 password manager product in all current planning documents.

## Source-of-Truth Order

1. Product scope, target user, goals, non-goals, and trust posture come from `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`.
2. Engineering stack, file layout, milestone order, and execution sequence come from `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`.
3. `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1.md` remains a reference draft only. It can be mined for copy or test ideas, but it should not override the roadmap.

## Why This Is The Baseline

- The design spec and the earlier implementation plan were both created at `2026-03-14 13:47:53 +0800`.
- The roadmap was created later at `2026-03-14 15:12:05 +0800`.
- The roadmap also contains the more complete engineering picture: workspace manifests, package boundaries, Supabase boundary, API client package, and launch docs.

## Resolved Decisions

### Product Baseline

- Use Bitwarden as the functional baseline and reference architecture for vault behavior, crypto expectations, and password-manager UX patterns.
- Keep the approved phase-1 surface area from the design spec: public cloud, personal users, Chinese-first, browser extension + web vault + iPhone, passwords only.

### Infrastructure Baseline

- Use Supabase for Auth and Postgres as the initial managed backend foundation.
- Keep core vault business logic in the product's TypeScript API layer instead of pushing domain logic into Supabase directly.

### Canonical Tech Stack

- Workspace: pnpm monorepo
- Backend: Node.js, TypeScript, Fastify, PostgreSQL, Supabase, Drizzle
- Web: Next.js, React, Tailwind CSS
- Browser extension: WXT
- iPhone: SwiftUI
- Testing: Vitest, Playwright, XCTest

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

- Prefer the roadmap's concrete framework choices over the earlier generic draft.
- Web routes should follow the Next.js App Router structure shown in the roadmap, such as `apps/web/src/app/security/page.tsx`, not the earlier generic `src/routes` layout.
- API route groups should follow the roadmap naming: `/auth`, `/vault`, `/devices`, `/imports`, and `/activity`.
- Browser import should live under `/imports/browser`.
- Shared client access for web and extension should live in `packages/api-client`.

### Canonical Delivery Sequence

1. Milestone M1: workspace, schema boundary, and client-side security model
2. Milestone M2: API skeleton and web trust shell
3. Milestone M3: browser daily-use loop and shared sync contract
4. Milestone M4: migration flow, iPhone credibility, and launch trust loop

## Immediate Next Step

Start with roadmap Milestone M1 Task 1:

- create the root workspace manifests
- create the `apps/`, `packages/`, and `infra/` skeleton
- record the workspace layout in `docs/architecture/0001-workspace-layout.md`

No implementation work should treat the earlier draft plan as canonical unless this baseline document is updated explicitly.
