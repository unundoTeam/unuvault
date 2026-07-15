# API Observability Current-Main Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reapply the already-tested, provider-neutral API observability foundation onto current `origin/main` while preserving its two source commits and keeping every production-operations maturity gate honest and open.

**Architecture:** Preserve the existing extraction as provenance-bearing commits instead of rewriting it. The first commit adds an injectable no-op-by-default `ObservabilitySink`, a fixed allowlist-only completion event, API contract tests, and provider-neutral operations documents; the second commit ensures emission occurs only after the final Fastify response. Current-main preflight found no overlapping changes since source base `361588cc4928e6e166bf1599be583c366d00d22b`, so the planned operation is a clean two-commit cherry-pick followed by focused and repository-authoritative verification.

**Tech Stack:** TypeScript 5.9, Fastify 5, Vitest 4, pnpm 10, Markdown operations contracts

## Global Constraints

- Branch starts at current `origin/main` commit `be941437f6f9b9be79b39c71e39431e05ccbddbd`.
- Preserve source commits in order: `90381620a8ec595e9fabf9601e49421c97b5dd45`, then `d47672ef2e83393cb0c68b1b7466a3addb9a1c8d`.
- Preserve the first commit's `Source-Commit: ad18fb3853b18eee8bbc9b3f0742f44e38b442c9` provenance trailer.
- Do not select or configure a telemetry provider, exporter, dashboard, retention policy, alert destination, on-call rotation, or incident rehearsal.
- The default production sink remains no-op; observability failure or latency must never alter API status, body, or completion timing.
- Events remain low-cardinality and allowlist-only: Fastify route template (or `__unmatched__`), normalized method, status class, latency bucket, and bounded request ID only.
- Never collect raw URLs, query values, request/response bodies, headers, cookies, tokens, passwords, vault data, ciphertext, raw errors, stacks, or error messages.
- Treat `docs/operations/runtime-authority.md` as the repo-local runtime authority and keep telemetry, automated alerting, on-call, and rehearsal maturity gates explicitly open.
- The extraction is one complete GREEN review unit. Do not stop after a RED-only test or after only the first source commit.
- If either cherry-pick conflicts despite the clean merge-tree preflight, run `git cherry-pick --abort`, leave the branch at its pre-pick state, and revise this plan with an exact RED-GREEN adaptation before changing production code. Do not resolve conflicts ad hoc.

---

### Task 1: Preserve and verify the complete API observability extraction

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/lib/observability.ts`
- Create: `apps/api/tests/observability.spec.ts`
- Create: `docs/operations/telemetry-contract.md`
- Create: `docs/operations/alerting-policy.md`
- Create: `docs/operations/incident-rehearsal-template.md`
- Modify: `docs/operations/production-ops-observability-closeout.md`
- Modify: `docs/operations/runtime-authority.md`
- Test: `tests/runtime-authority-contract.spec.ts`

**Interfaces:**
- Consumes: Fastify request lifecycle (`onRequest`, `onResponse`), `request.routeOptions.url`, `reply.statusCode`, and the existing exported `app` contract.
- Produces: `buildApp(options?: BuildAppOptions)`, `BuildAppOptions.observabilitySink?: ObservabilitySink`, `ObservabilityEvent`, `ObservabilitySink`, `NOOP_OBSERVABILITY_SINK`, `classifyLatencyBucket(number)`, `normalizeRequestId(unknown)`, and `createHttpObservabilityEvent(input)`.

- [ ] **Step 1: Reconfirm the exact source boundary before mutation**

Run:

```bash
git status --short
git rev-parse HEAD
git log --format='%H %s%n%b' origin/main..codex/api-observability-clean-extraction
git diff --name-status origin/main...codex/api-observability-clean-extraction
```

Expected: status is clean; `HEAD` is `be941437f6f9b9be79b39c71e39431e05ccbddbd`; the source contains exactly the two commits listed in Global Constraints; the diff contains exactly the nine files listed above.

- [ ] **Step 2: Apply the provider-neutral foundation commit without rewriting provenance**

Run:

```bash
git cherry-pick 90381620a8ec595e9fabf9601e49421c97b5dd45
```

Expected: cherry-pick succeeds without conflicts and creates a commit titled `feat(api): add redacted observability foundation` whose body still contains `Source-Commit: ad18fb3853b18eee8bbc9b3f0742f44e38b442c9`.

- [ ] **Step 3: Apply the final-response completion fix**

Run:

```bash
git cherry-pick d47672ef2e83393cb0c68b1b7466a3addb9a1c8d
```

Expected: cherry-pick succeeds without conflicts and creates `fix(api): emit final observability completion events`; `apps/api/src/app.ts` emits only from `onResponse`, after Fastify has finalized the response status.

- [ ] **Step 4: Run the focused observability contract tests**

Run:

```bash
corepack pnpm --filter @unuvault/api exec vitest --run tests/observability.spec.ts
```

Expected: one test file passes. Coverage includes latency buckets, bounded request IDs, `2xx`/`4xx`/`5xx`, route templates, unmatched routes, exactly-once thrown errors, mapped final error responses, secret canaries, rejected and slow sinks, and the default no-op sink.

- [ ] **Step 5: Run the runtime-authority contract**

Run:

```bash
./node_modules/.bin/vitest --run tests/runtime-authority-contract.spec.ts
```

Expected: the contract passes and proves that provider/export, test-alert delivery, named responders, and rehearsal execution remain open while the provider-neutral foundation is documented.

- [ ] **Step 6: Run the complete API regression and type check**

Run:

```bash
corepack pnpm --filter @unuvault/api test
corepack pnpm --filter @unuvault/api lint
```

Expected: all API tests pass and TypeScript reports no errors. The pre-extraction current-main baseline was 16 test files and 245 tests passing.

- [ ] **Step 7: Run repository-authoritative verification**

Run:

```bash
corepack pnpm lint
corepack pnpm test
git diff --check origin/main...HEAD
```

Expected: lint/typecheck passes, the root and recursive workspace tests pass, and `git diff --check` prints no whitespace errors.

- [ ] **Step 8: Verify commit provenance and final cleanliness**

Run:

```bash
git log --format='%H %s%n%b' --reverse origin/main..HEAD
git diff --name-status origin/main...HEAD
git status --short
```

Expected: after this plan commit, the implementation history contains the two source commits in their original order and retains the `Source-Commit` trailer; the implementation diff is limited to the nine declared files; status is clean.

---

## Review Package

Review the complete GREEN unit from the plan-only base through the second extracted commit. The reviewer must confirm:

- exactly one allowlist-only completion event per completed response;
- final mapped status and latency are observed only after response completion;
- raw attacker-controlled or secret-bearing values cannot enter the event;
- sink rejection, synchronous throw, or unresolved latency cannot alter API behavior;
- default runtime remains provider-neutral and no-op;
- operations docs do not claim configured telemetry, dashboards, alerting, on-call, or an executed rehearsal;
- no files outside the nine-file extraction boundary changed.
