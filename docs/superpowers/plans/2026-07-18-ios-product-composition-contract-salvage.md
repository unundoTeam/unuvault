# iOS Product Composition Contract Salvage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the still-current iOS product-composition invariants from the local-only historical branch in a fresh-main architecture contract, while aligning repo-facing design-authority wording with the portfolio registry.

**Architecture:** Add one current runtime contract that separates implemented invariants, unimplemented requirements, and proof gaps. Lock that boundary with one focused contract test, then align the contributor entrypoints and two retained evidence ledgers that currently overstate the Pencil frame status. Do not implement Swift behavior, mutate Pencil, or change the historical branch.

**Tech Stack:** Markdown architecture contracts, Vitest contract tests, existing SwiftUI source and tests as read-only evidence.

## Global Constraints

- Base all changes on `main@c817580048d4cef292ebfe314a58f5d7a0c345ed` in `codex/ios-product-composition-contract-salvage`.
- Treat `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-operating-index.md` and its routed Pencil registry as the design-authority boundary.
- Treat `docs/superpowers/specs/2026-07-13-ios-product-composition-design.md` from `codex/ios-product-composition-spec@8fea5985ed0cfbc0dec32da7b9642f6d27bf178f` as salvage provenance only, never current authority.
- Do not cherry-pick the historical commit or copy its stale baseline, promotion, implementation-plan, rollback, or self-acceptance claims.
- Do not modify Swift, tests outside the focused contract test and the existing authority/evidence assertions in `tests/workspace-entrypoints.spec.ts`, Pencil files, PR #80, PR #71, the dirty pairing worktree, `unuOS` #118, or the historical branch/ref.
- Preserve the distinction between implemented runtime invariants, current unimplemented requirements, and manual/fresh proof gaps.
- No product secret, pairing secret, invite payload, or production data may appear in the contract or tests.

---

### Task 1: Salvage the current iOS product-composition contract

**Files:**
- Create: `tests/ios-product-composition-contract.spec.ts`
- Modify: `tests/workspace-entrypoints.spec.ts`
- Create: `docs/architecture/0009-ios-product-composition-contract.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `apps/ios/README.md`
- Modify: `docs/design/mobile-native-adapter-evidence.md`
- Modify: `docs/design/mac-companion-mvp-evidence.md`

**Interfaces:**
- Consumes: current SwiftUI implementation in `apps/ios/App/Sources/Features/ProductComposition/IOSProductCompositionView.swift`, host deep-link handling in `apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift`, the iOS tests, the portfolio design registry, and the historical branch-only spec as provenance.
- Produces: one stable architecture pointer for current iOS composition behavior and one focused test that rejects future collapse of implemented, unimplemented, and proof-gap states.

- [x] **Step 1: Write the failing contract test**

Create `tests/ios-product-composition-contract.spec.ts` with direct file reads and assertions that require:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readText = (path: string) => readFileSync(path, "utf8");

describe("iOS product composition contract", () => {
  it("routes current runtime semantics through architecture 0009", () => {
    const contract = readText("docs/architecture/0009-ios-product-composition-contract.md");
    const readme = readText("README.md");
    const agents = readText("AGENTS.md");
    const iosReadme = readText("apps/ios/README.md");

    expect(readme).toContain("`docs/architecture/0009-ios-product-composition-contract.md`");
    expect(contract).toContain("## Implemented invariants");
    expect(contract).toContain("## Current unimplemented requirements");
    expect(contract).toContain("## Proof gaps");
    expect(contract).toContain("late startup load must not override a user-selected destination");
    expect(contract).toContain("invalid deep link must select Pairing");
    expect(contract).toContain("second deep link");
    expect(contract).toContain("typed safe-load failure");
    expect(contract).toContain("stale-result generation or cancellation ownership");
    expect(contract).toContain("post-import reload progress");
    expect(contract).toContain("VoiceOver route focus");
    expect(contract).toContain("current/unuvault/ios-vault-home-native-locked-v1");
    expect(contract).toContain("current/unuvault/ios-vault-list-readonly-v1");
    expect(contract).toContain("8fea5985ed0cfbc0dec32da7b9642f6d27bf178f");
    expect(contract).toContain("salvage provenance only");
    expect(contract).toContain("Pencil sync: not proven by this contract");

    for (const text of [readme, agents, iosReadme]) {
      expect(text).not.toContain("Current iOS source frames: `current/unuvault/ios-product-composition-v1`");
      expect(text).not.toContain("`current/unuvault/ios-pairing-invite-receive-v3`. Vault and Pairing");
    }
  });
});
```

In `tests/workspace-entrypoints.spec.ts`, replace only the four iOS design-authority assertions around the existing design-entrypoint and pairing-boundary tests. The new assertions must require `current/unuvault/ios-vault-home-native-locked-v1` and `current/unuvault/ios-vault-list-readonly-v1`, and must reject `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3` inside `agentDesignAuthority` / `agentNotes`.

Also change only the existing iOS mobile-adapter and Mac-companion evidence assertions so they require the registered home/list frames plus `docs/architecture/0009-ios-product-composition-contract.md`, and reject claims that composition-v1/pairing-v3 are current or approved. Run the adjacent test after these assertion changes and before editing the evidence docs; the stale evidence wording must produce RED.

Add focused and adjacent assertions that require architecture 0009 to record the implemented valid-deep-link route (`Pairing` selection, invite forwarding, and a single host pairing attempt), reject the iOS README phrase `promoted product composition`, and require the mobile evidence claim boundary to say `Pencil sync: blocked` while rejecting `current matches implementation`.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm exec vitest run tests/ios-product-composition-contract.spec.ts tests/workspace-entrypoints.spec.ts
```

Expected: FAIL because `docs/architecture/0009-ios-product-composition-contract.md` does not exist and the current repo-facing authority text still contains the unregistered frame claims. Failures must be contract/authority assertion failures, not TypeScript or import errors.

- [x] **Step 3: Write the minimal current contract**

Create `docs/architecture/0009-ios-product-composition-contract.md` with these exact sections and boundaries:

```markdown
# iOS Product Composition Contract

## Status and authority
## Product boundary
## Implemented invariants
## Current unimplemented requirements
## Proof gaps
## Design Gate
## Verification
## Salvage provenance and lifecycle
```

The content must state:

- Current runtime source is the composition SwiftUI model/view plus current iOS tests, not the old branch spec.
- Implemented invariants include two always-reachable Vault/Pairing destinations; app-default received-store startup routing; fresh store-reader reload after import; non-empty metadata before switching to Vault; parser/single-flight foundations; metadata-only/no-visible-secret; retry and existing accessibility semantics.
- Implemented invariants also include valid deep-link routing: the host accepts one valid invite, waits until startup loading is settled, selects Pairing, forwards the invite, and starts one pairing attempt; concurrent or second attempts remain single-flight.
- Unimplemented requirements are the seven reviewed gaps: late startup selection ownership, invalid deep-link recovery UI, visible busy second-link feedback, typed safe-load failure, stale-result generation/cancellation ownership, explicit post-import reload progress, and VoiceOver route focus/announcement deduplication.
- Proof gaps explicitly cover fresh VoiceOver rotor, Reduce Motion, landscape, safe-area, dark/light parity, and real-device/simulator evidence; screenshots or passing tests alone do not prove Pencil sync.
- The portfolio registry currently names `current/unuvault/ios-vault-home-native-locked-v1`, `current/unuvault/ios-vault-list-readonly-v1`, and `current/unuvault/design-system-v1`; composition-v1/pairing-v3 must not be claimed as current unless the portfolio authority is updated through its own gate.
- Design Gate reports docs-only contract salvage, no Swift/Pencil mutation, `Pencil sync: not proven by this contract`, `Pencil preflight: not applicable`, and `Pencil lease: not applicable`.
- Verification points to the focused contract test and current canonical repo gates without claiming they were run inside the contract.
- Provenance records the old branch, SHA, unique old path, and `salvage provenance only`; it states the old branch remains until a separate lifecycle closeout and explicit deletion approval.

- [x] **Step 4: Normalize repo-facing authority wording**

Update only the authority/pointer paragraphs in `README.md`, `AGENTS.md`, `apps/ios/README.md`, `docs/design/mobile-native-adapter-evidence.md`, and `docs/design/mac-companion-mvp-evidence.md`; the corresponding existing test assertions were already changed in Step 1 to create RED:

- Add `docs/architecture/0009-ios-product-composition-contract.md` to `README.md` `Source Of Truth` as the current runtime-composition contract.
- Replace claims that composition-v1/pairing-v3 are current Pencil frames with the exact frames currently registered by the portfolio index: `current/unuvault/ios-vault-home-native-locked-v1` and `current/unuvault/ios-vault-list-readonly-v1`.
- Preserve the truthful statement that the current SwiftUI runtime contains the product composition and Pairing flow, but route that implementation claim to architecture 0009 rather than treating unregistered frame names as design authority.
- Preserve existing evidence links as historical implementation/visual evidence and do not upgrade them into fresh parity proof.
- In the two evidence ledgers and the README simulator paragraph, describe composition-v1/pairing-v3 as historical implementation/visual evidence rather than current or approved frames; point current runtime behavior to architecture 0009 and current design authority to the registered home/list frames.
- Replace the iOS README's broad `promoted product composition` wording with historical simulator runtime evidence wording. Change the mobile evidence claim-boundary label from `current matches implementation` to `Pencil sync: blocked`, with the exact reason that fresh product-composition/pairing parity against registered current authority is not proven.

- [x] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
corepack pnpm exec vitest run tests/ios-product-composition-contract.spec.ts
```

Expected: 1 test file passed, 1 test passed, 0 failures.

- [x] **Step 6: Run adjacent contract and formatting checks**

Run:

```bash
corepack pnpm exec vitest run tests/ios-product-composition-contract.spec.ts tests/workspace-entrypoints.spec.ts
git diff --check
```

Expected: both test files pass and `git diff --check` exits 0 with no output.

- [x] **Step 7: Self-review the exact diff**

Confirm:

- the diff contains only the eight implementation/test files listed above plus this plan;
- no Swift, `.pen`, lockfile, package manifest, PR body, branch/ref, or cross-repo file changed;
- no current implementation or Pencil-parity claim exceeds the evidence;
- no unfinished marker, sample invite, secret, or placeholder remains;
- the historical branch is not deleted or renamed.

- [x] **Step 8: Commit after review approval**

The first independent review identified two blockers. Both were fixed and
verified; when a fresh independent re-review surface remained unavailable, the
user explicitly approved the parent task's current-diff review as the final
commit gate.

Stage the nine scoped files and commit:

```bash
git add AGENTS.md README.md apps/ios/README.md docs/architecture/0009-ios-product-composition-contract.md docs/design/mobile-native-adapter-evidence.md docs/design/mac-companion-mvp-evidence.md docs/superpowers/plans/2026-07-18-ios-product-composition-contract-salvage.md tests/ios-product-composition-contract.spec.ts tests/workspace-entrypoints.spec.ts
git commit -m "docs: salvage iOS product composition contract"
```

Do not push, open a PR, or clean up either the new or historical branch without separate user approval.
