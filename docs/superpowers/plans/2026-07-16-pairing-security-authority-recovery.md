# Pairing Security Authority Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the approved narrow Pairing V2 protocol/security authority in `unuvault`, register that authority in `unuOS`, and make the retained observability foundation line eligible for a later, separately approved salvage decision.

**Architecture:** PR A changes exactly twelve `unuvault` files: two contract tests drive a manual rewrite of current-main documentation plus one recovered protocol/security spec. Only after PR A merges, PR B changes exactly one `unuOS` inventory file and records the same narrow route without changing the dated snapshot count. Each implementation task ends green, committed, and independently reviewed; the final task verifies the two-repository handoff and prepares review evidence without changing product or design semantics.

**Tech Stack:** Markdown authority documents, TypeScript/Vitest contract tests, pnpm workspace verification, Python/pytest `unuOS` governance checks, Git worktrees, GitHub pull requests.

Normative source design: `docs/superpowers/specs/2026-07-16-pairing-security-authority-recovery-design.md` as tracked on the current task branch; later reviewed amendments to that file remain authoritative.

Commit `3af9dc50be9269f58f8e91407c68ba2a0d682e73` is a historical baseline only. It is not a standalone or current approved normative source and cannot override later amendments.

## Global Constraints

- Use the current tracked normative source design named above; the historical baseline commit is provenance only.
- Pairing V1 remains the implemented proof boundary on `main`; Pairing V2 remains an approved protocol/security design whose implementation and exact-target security re-review are pending.
- The current V1 proof includes claimant-key-bound handoff open, AES-GCM encrypted local persistence, fresh reload, and read-only metadata projection. It does not authenticate the intended target device and does not require fresh Mac owner authorization before a production whole-vault transfer.
- The bounded Argon2 hostile-parameter policy is implemented and resolved. It does not clear Pairing V2, local bridge authorization, restart-persistent replay rejection, exact-target cross-platform re-review, independent review, or public-launch approval.
- PR `#59` and merge commit `46ae0c655deef0ef15cb0cd180b4844a32cac43d` are historical evidence only for their recorded Web/browser-extension/CLI JavaScript substrate. The 2026-04 clearance and launch exception must not be expanded to later native Mac/iOS or Pairing V2 scope.
- A future review or dispatch must name one exact merged `main` SHA for the final remediated boundary. Until that immutable SHA exists, record `exact merged implementation SHA: not yet assigned` and `dispatch state: not dispatched`; never substitute a branch, range, `latest main`, `at or after`, or the historical PR `#59` SHA.
- The write set is exactly twelve `unuvault` implementation files and one `unuOS` implementation file. The approved recovery design and this implementation plan are planning evidence and are not part of that thirteen-file implementation set.
- Do not cherry-pick commit `08959197b620737f5a692b45c9a9cd59aeb79d82`; use its line only as historical evidence while manually editing from current `main`.
- Do not restore the Mac distribution receipt, stale implementation plans, PNG/screenshots, historical Pencil evidence, old iOS code/tests, old runner changes, API code, or any other file from the retained foundation line.
- Do not change UI structure, copy treatment, visual hierarchy, interaction, accessibility, `.pen` files, Pencil current/draft authority, or approved frame status. `Design Gate`, `Pencil sync`, and `Pencil lease` are `not applicable` for this documentation-and-contract recovery.
- Do not use secrets, live credentials, signing/notarization, physical-device execution, live external-review dispatch, production mutation, or destructive branch cleanup.
- Keep current `main` facts that postdate `0895919`: current iOS product-composition/import/reload evidence, current design frames `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3`, bounded Argon2 policy, browser-import hardening, PR `#79` observability truth, and current verification serialization/wrappers.
- PR A (`unuvault`) must merge before PR B (`unuOS`) is implemented and opened. The bounded drift window must be called out; the inventory must never point at a spec absent from `unuvault/main`.
- Do not delete or retire `codex/api-observability-foundation` until both PRs merge and a separate final salvage review proves that no unique authority remains.
- Push, PR creation/readiness, merge, rollback, branch/worktree deletion, and foundation cleanup remain separate user-approval boundaries.

## Repositories And Isolated Worktrees

| Repository | Isolated worktree | Branch | Planning base |
| --- | --- | --- | --- |
| `unuvault` | `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery` | `codex/pairing-security-authority-recovery` | `origin/main` at `16b0bfe3734cb2aa5233710e09b6b25684a5408e`; historical design-baseline commit `3af9dc50be9269f58f8e91407c68ba2a0d682e73` is already on the task branch, while the tracked design file remains normative |
| `unuOS` | `/Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory` | `codex/unuvault-pairing-authority-inventory` | `origin/main` at `f2ef04f52d863b27c2442fcf71909e02e4bc1e00`; Task 2 must fast-forward to the then-current `origin/main` after PR A merges and before editing |

The root checkouts are out of scope. Do not switch them, clean them, stage their files, or reuse their dirty state.

## Exact Implementation Write Set

### `unuvault` — twelve files

1. `AGENTS.md`
2. `README.md`
3. `apps/ios/README.md`
4. `docs/architecture/0005-secure-password-crypto.md`
5. `docs/launch/phase1-launch-checklist.md`
6. `docs/operations/crypto-review-gate.md`
7. `docs/operations/crypto-review-launch-exception.md`
8. `docs/operations/secure-crypto-pr-audit-handoff.md`
9. `docs/operations/third-party-crypto-review-request.md`
10. `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`
11. `tests/launch-packet-contract.spec.ts`
12. `tests/workspace-entrypoints.spec.ts`

### `unuOS` — one file

1. `docs/portfolio/design-specs-inventory.md`

---

### Task 1: Recover The UnuVault Pairing Security Authority

**Files:**
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/tests/launch-packet-contract.spec.ts`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/tests/workspace-entrypoints.spec.ts`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/AGENTS.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/README.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/apps/ios/README.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/architecture/0005-secure-password-crypto.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/launch/phase1-launch-checklist.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/crypto-review-gate.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/crypto-review-launch-exception.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/secure-crypto-pr-audit-handoff.md`
- Modify: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/third-party-crypto-review-request.md`
- Create: `/Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`

**Interfaces:**
- Consumes: the approved recovery design; current-main V1 documentation; historical PR `#59` evidence; the already-implemented bounded Argon2 policy.
- Produces: one repo-local Pairing V2 protocol/security authority route, a truthful cross-platform security packet, and contract tests that reject a V1/V2 or historical/current scope collapse.

- [ ] **Step 1: Reconfirm the task branch and twelve-file boundary before editing**

Run:

```bash
cd /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery
test "$(git branch --show-current)" = "codex/pairing-security-authority-recovery"
test "$(git merge-base HEAD origin/main)" = "16b0bfe3734cb2aa5233710e09b6b25684a5408e"
git status --short
git show --no-patch --format='%H %s' 3af9dc50be9269f58f8e91407c68ba2a0d682e73
```

Expected: the branch and merge base match; status is clean; the historical design-baseline commit is present for provenance. Stop if unrelated changes appear.

- [ ] **Step 2: Add the failing launch-packet contract**

Replace the existing broad deferred-review test in `tests/launch-packet-contract.spec.ts` with tests that load the six security-packet documents and assert all of these exact invariants:

```ts
expect(request).toContain("dispatch state: `not dispatched`");
expect(request).toContain("exact merged implementation SHA: `not yet assigned`");
expect(request).toContain("historical PR `#59` target cannot substitute");
expect(request).not.toMatch(/at or after\s+`46ae0c655deef0ef15cb0cd180b4844a32cac43d`/);

expect(gate).toContain(
  "Current cross-platform internal review status: `blocked pending remediation and exact-target re-review`",
);
expect(gate).toContain("Bounded Argon2 checkpoint: `resolved`");
expect(gate).toContain("Pairing target-claim authentication: `pending on main`");
expect(gate).toContain("Fresh Mac owner authorization: `pending on main`");
expect(gate).toContain("Restart-persistent iOS replay rejection: `pending on main`");
expect(gate).toContain("Local bridge authorization: `separate open blocker`");

expect(exception).toContain("## Historical Exception Status (2026-04-25)");
expect(exception).toContain("46ae0c655deef0ef15cb0cd180b4844a32cac43d");
expect(exception).toContain("does not authorize the later native/cross-platform boundary");

expect(checklist).toContain("Current preliminary cross-platform review verdict: `blocked`");
expect(checklist).toContain("Historical PR `#59` clearance remains scoped to its recorded target");
expect(checklist).not.toContain("current GA/public-launch crypto gate as an internal");

expect(architecture).toContain("## Two Crypto Substrates");
expect(architecture).toContain("Pairing V2 does not resolve local bridge authorization");
expect(architecture).not.toContain("share one crypto substrate");

expect(handoff).toContain("Bounded Argon2 checkpoint: `resolved`");
expect(handoff).toContain("Cross-platform preliminary verdict: `blocked`");
expect(handoff).toContain("No independent third-party verdict exists for the expanded scope");
```

Use the existing `readText()` helper. Do not add assertions for the excluded Mac distribution receipt, UI frames, screenshots, code, or live-review dispatch.

- [ ] **Step 3: Tighten the failing workspace-entrypoint contract**

In the existing `records the cross-surface iOS and Mac pairing-boundary proof entrypoint` test in `tests/workspace-entrypoints.spec.ts`, add `agentNotes` and `iosReadme` reads and these assertions while preserving every current v3 composition/frame assertion elsewhere in the file:

```ts
expect(readme).toMatch(
  /claimant-key-bound handoff\s+open, AES-GCM encrypted local persistence, fresh reload, and read-only/,
);
expect(iosReadme).toContain(
  "The current V1 claim does not authenticate that claimant as the intended iPhone.",
);
for (const entrypoint of [readme, agentNotes, iosReadme]) {
  expect(entrypoint).toContain(
    "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
  );
}
expect(readme).toContain("Pairing V1 remains the implemented proof boundary");
expect(readme).toContain("Pairing V2 implementation and exact-target security re-review remain pending");
expect(agentNotes).not.toContain("current/unuvault/mac-companion-pairing-approval-v2");
expect(agentNotes).toContain("current/unuvault/ios-product-composition-v1");
expect(agentNotes).toContain("current/unuvault/ios-pairing-invite-receive-v3");
```

Also extend `keeps agent design entrypoints aligned with portfolio routing` so README and AGENTS both describe the recovered file as `current-routed` for `Pairing V2 protocol/security semantics only`, and both explicitly deny broad Pencil/current-UI authority.

- [ ] **Step 4: Run the focused tests and record RED**

Run:

```bash
corepack pnpm exec vitest run tests/launch-packet-contract.spec.ts tests/workspace-entrypoints.spec.ts
```

Expected: FAIL because the recovered spec and the exact V1/V2, open-blocker, dispatch-state, and historical-scope wording are absent. The pre-change baseline for this exact command is `2 files / 25 tests passed`; the new assertions, not an unrelated existing failure, must produce RED.

- [ ] **Step 5: Create the narrow Pairing V2 protocol/security spec**

Create `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md` with this exact status line:

```markdown
> Status: approved protocol/security design; implementation on main pending; exact-target security re-review pending.
```

Use these exact top-level sections and content boundaries:

1. `Purpose And Authority Boundary`: protocol/security semantics only; no broad Pencil/current-UI authority; V1 is current, V2 pending; UI implementation must pass a future design/Pencil gate.
2. `Current V1 Boundary`: parse invite, claimant identity, `/v1/pairing/claim`, claimant-key-bound AES-GCM open, encrypted received-vault persistence, fresh reload, read-only metadata; explicitly state missing intended-target authentication and fresh Mac owner approval.
3. `Threat Model And Security Invariants`: hostile LAN and racing local process; public invite fields, source IP, display name, target-provided fingerprint, LAN reachability, and an unlocked-vault session are not authentication.
4. `Canonical Encoding`: normative `LP(bytes) = u32be(byteLength) || bytes`; fixed domain/order; strict unpadded base64url round-trip; canonical DER round-trip; NFC UTF-8; canonical epoch milliseconds; bounded canonical LAN URL.
5. `Target-Claim Authentication`: fresh 32-byte `pairingSecret`, fresh P256 target identity and client nonce, a byte-exact 32-byte session-bound `claimAuthKey` derived by HKDF-SHA256, `HMAC-SHA256(claimAuthKey, canonicalClaimTranscript)`, constant-time verification, server-owned invite fields, bounded hostile-LAN request input, and one generic authentication failure with no state disclosure or mutation.
6. `Fresh Mac Owner Authorization`: show target identity and expiry; fresh `LAContext` per `Confirm & send`; `deviceOwnerAuthentication`; recheck session/target/expiry/lock/revoke/lost-device/capability before exactly one in-memory snapshot read; owner denial/cancellation records `denied`, owner-authentication unavailability or evaluation/system error records `invalidated`, and every failure creates no handoff or plaintext log.
7. `Target-Bound Handoff`: fresh ephemeral P256 ECDH; QR-secret-bound HKDF-SHA256 context; AES-GCM versioned snapshot and canonical AAD; exact algorithm `P256-HKDF-SHA256-AES-GCM-256-V2`; no secret/private/derived/capability/plaintext fields in the public response.
8. `Single Use And Persistent Replay Rejection`: atomic reservation; during `authorizing` and `sealing`, only the reserved byte-identical retry can observe pending behavior and no retry window exists; the retry window starts only at the atomic `ready` transition, with deadline `min(readyAt + 30 seconds, original invitation expiry)`; a different valid authenticated retry identity gets `handoff_consumed` without mutating, replacing, or extending the reservation; encrypted-store atomic persistence of `handoffId` and `claimId`; rejection survives restart; no V2-to-V1 downgrade.
9. `Terminal Cleanup And Bounded Recovery`: `consumed`, `denied`, `expired`, `invalidated`; classify exclusive terminal mutations across owner decision, owner-authentication system outcome, invitation or capability lifecycle, reservation/session/target recheck, internal read or snapshot, key derivation, sealing, persistence, pre-ready process failure, restart recovery, and the immutable ready-window deadline transition from `ready` to `consumed`; explicitly classify lifecycle outcomes discovered during recheck under the lifecycle category and interrupted work recovered after restart under restart recovery; retain only the sealed response, encrypted `claimAuthKey`, and minimum retry metadata after `ready`; perform best-effort owned-buffer cleanup without claiming Swift runtime zeroization; preserve durable replay and terminal tombstones.
10. `Separate Open Security Boundaries`: local bridge bearer mismatch, persistent replay implementation, final exact-target cross-platform review, independent third-party review, and public-launch decision remain open; bounded Argon2 is resolved but does not clear them.
11. `Implementation And Review Exit Criteria`: implementation commits are future work; final packet must record one exact merged SHA; external status remains `not dispatched` until then.
12. `Design Gate`: `UI impact: none`, `Classification: no-ui-impact`, `Design review: not applicable`, `Pencil current read/mutation: not performed`, `Pencil draft mutation: not performed`, `Pencil sync: not applicable`, `Pencil lease: not applicable`, `Approval-frame authority: not restored`.

Use these canonical reservation semantics in the recovered spec and every summary in this plan:

- An unauthenticated or malformed request receives the same generic authentication failure, with no state disclosure or mutation.
- A different valid authenticated retry identity while the encrypted `claimAuthKey` verifier exists after reservation receives terminal `handoff_consumed` and cannot mutate, replace, or extend the reservation.
- Only the reserved byte-identical retry may observe pending or ready behavior.
- While an encrypted `claimAuthKey` verifier exists in `authorizing`, `sealing`, or pre-deadline `ready`, the Mac authenticates the canonical request before selecting a state-dependent response: the reserved byte-identical identity receives only its allowed pending or ready behavior, while a different valid authenticated identity receives `handoff_consumed`.
- An `inviteSessionId` lookup alone never authorizes `handoff_consumed`.
- After `consumed`, `denied`, `expired`, or `invalidated` clears the verifier, every request receives the generic authentication failure with no state disclosure or mutation, even when its `inviteSessionId` matches a terminal tombstone.
- During `authorizing` and `sealing`, only the reserved byte-identical retry may receive `handoff_response_not_ready`; no retry window exists before `ready`.
- The ready recovery window begins only when the durable reservation atomically transitions to `ready`; `readyAt` is the timestamp written by that same transaction, and the immutable deadline is `min(readyAt + 30 seconds, original invitation expiry)`.
- Before the immutable deadline, processing the initial response, a byte-identical retry, a different valid authenticated retry identity, or an invalid authenticator does not by itself transition `ready` to `consumed` or `invalidated`, move `readyAt`, or shorten or extend the window.
- An independent trusted local lock, revoke, lost-device, or capability invalidation event during `ready` atomically transitions the reservation to `invalidated` immediately and clears the retained sealed response, retry identity, and encrypted `claimAuthKey`; security revocation takes priority over the recovery deadline.
- The normative state machine permits `invalidated` from `authorizing` or `sealing` for the terminal owners classified below, and from `ready` only for an independent trusted local lock, revoke, lost-device, or capability invalidation event.
- No other owner-authentication, internal, persistence, process, or request-processing outcome may transition `ready` early.
- The only state-owning terminal mutations are exclusive and classified as follows: fresh owner denial or cancellation records `denied`; invitation expiry records `expired`; owner-authentication unavailability or `LAContext` evaluation or system error records `invalidated`; lock, revoke, lost-device, or capability invalidation records `invalidated`, including an immediate atomic `ready` to `invalidated` transition for an independent trusted local lifecycle event; reservation identity, vault session identity, or authenticated-target recheck failure records `invalidated`, while expiry and lifecycle outcomes discovered by that recheck remain classified under their preceding categories; internal read or snapshot, key-derivation, sealing, persistence, or process failure before `ready` records `invalidated` when the worker can commit the terminal write; restart recovery records any live `issued`, unfinished `authorizing`, or unfinished `sealing` record as `invalidated` before claim handling or QR display, using the atomic issued-recovery rule; and reaching the immutable ready-window deadline transitions `ready` to `consumed` only if no prior security invalidation occurred.
- These rules preserve no-downgrade behavior and every required durable reservation, replay, and terminal tombstone.

Use this exact claim-authentication derivation and ownership model:

- Before an invitation QR may be displayed or activated, the Mac derives the
  32-byte `claimAuthKey` from the raw 32-byte `pairingSecret` and the immutable
  server-owned `PAIRING_VERSION`, NFC `inviteSessionId`,
  `expiresAtEpochMilliseconds`, and `canonicalMacBaseURL` using the byte-exact
  claim-authentication HKDF above.
- One issuance durable transaction commits all issuance authority together:
  the outer lifecycle state `issued`, immutable verifier provenance ID and
  envelope generation, the unique encrypted verifier ciphertext ownership or
  reference, and every immutable transcript input required to authenticate the
  first claim.
- The encrypted verifier envelope is keyed by `inviteSessionId`; its immutable
  authenticated plaintext payload contains exactly the 32-byte
  `claimAuthKey`, those immutable transcript inputs, the envelope format and
  version, and the same immutable verifier provenance ID and envelope
  generation, with no target-controlled field or mutable lifecycle state.
- Mutable lifecycle state (`issued`, `authorizing`, `sealing`, `ready`, or
  terminal) and the exact request and retry metadata exist only in the outer
  durable record or columns controlled by atomic compare-and-swap;
  `issued/unreserved` is never inside the encrypted envelope payload.
- No issuance component is visible independently; a failed or unknown commit
  keeps the QR hidden and inactive until one authoritative reread proves a
  complete, internally consistent `issued` record whose provenance,
  generation, ciphertext ownership, and transcript inputs all match.
- If that reread cannot prove the complete record, activation fails closed and
  idempotent recovery removes every orphaned ciphertext, ownership reference,
  or incomplete outer record.
- QR activation waits for the entire issuance transaction commit, never only
  the ciphertext or verifier-envelope commit.
- Crash recovery must never leave verifier ciphertext without its owning
  `issued` record or an `issued` record without its verifier ciphertext.
- On Mac process startup or recovery, before enabling claim handling or
  redisplaying any QR, every live `issued` record enters one atomic, mutually
  exclusive, and idempotent terminal transition to `invalidated`; the same
  commit deletes the invite verifier ciphertext ownership or reference, hides
  and revokes the old QR, preserves only the minimum tombstone, and requires a
  fresh invite.
- Recovery never accepts a claim from the durable `claimAuthKey` of a recovered
  `issued` record and never persists, reconstructs, or substitutes the raw
  `pairingSecret`.
- A failed or unknown recovery commit is resolved by one authoritative reread;
  if the record remains live `issued`, recovery repeats the same terminal
  transition, and claim handling and QR display stay disabled until the reread
  proves an `invalidated` tombstone with no verifier. At no intermediate or
  final durable point may a live verifier and terminal tombstone coexist.
- The claim-validation pipeline is normative and ordered:
  1. Enforce the raw HTTP entity-body cap of 4096 octets. Reject `Content-Length` greater than 4096 before reading; for chunked or unknown-length input, use one fixed bounded buffer and fail closed when the 4097th octet arrives.
  2. Perform JSON parsing, schema validation, strict base64url decoding, and required-field checks.
  3. NFC-normalize text and enforce UTF-8 lengths of 1–128 bytes for `targetDeviceId` and 1–256 bytes for `targetDisplayName`.
  4. Parse the target P256 SPKI DER and require canonical DER by exact re-serialization before accepting the public key.
  5. Perform constant-shape verifier retrieval keyed only by the server-owned `inviteSessionId`: make one bounded indexed verifier-record read; decrypt the live encrypted `claimAuthKey` when present; for an absent, terminal, non-live, or missing record, substitute an independent 32-byte process-owned dummy key and continue through the same HMAC path. This step makes no reservation-lifecycle or state-dependent response decision, never returns or logs the candidate key, and never recreates a terminal verifier. It does not claim perfect constant-time storage I/O; it requires only a fixed bounded response and computation shape with one generic external result.
  6. Compute HMAC-SHA256 with the candidate key and compare the supplied authenticator in constant time.
  7. Only when the HMAC authenticates with a live verifier, load the full reservation state and apply the exact-retry, different-valid-retry, and ready-security-invalidation rules. A dummy-key or invalid-authenticator path returns the same generic authentication failure with no state disclosure or mutation.
- Verifier retrieval is a minimal capability-key lookup, not an authenticated business-state lookup; the latter occurs only after HMAC authentication succeeds with a live verifier.
- Verifier retrieval obtains the live key and immutable transcript inputs from
  the encrypted invite envelope for a first claim or from the reservation
  verifier record after reservation; it reads no target-bound or
  business-lifecycle state before HMAC authentication.
- At process startup, the Mac generates an independent 32-byte process-owned
  dummy key with a CSPRNG and retains it only in mutable memory; it is never
  logged, returned, or persisted.
- Every request path—live invite-envelope candidate, live reservation-verifier
  candidate, and dummy candidate for a missing, terminal, or non-live
  record—enters one defer/finally cleanup scope before HMAC comparison and
  best-effort clears its request-local candidate plaintext and reference after
  comparison or error.
- Per-request cleanup never clears the process-owned dummy master buffer; it
  clears only the request-local candidate copy or reference, while the dummy
  master buffer remains mutable process-owned memory and is best-effort cleared
  only at process shutdown.
- `claimAuthKey` is a 32-byte, session-bound, domain-separated key derived from the raw `pairingSecret` with HKDF-SHA256.
- Define `CLAIM_AUTH_SALT_DOMAIN = ASCII("unuvault-pairing-claim-auth-salt-v2")`, `CLAIM_AUTH_INFO_DOMAIN = ASCII("unuvault-pairing-claim-auth-key-v2")`, and `CLAIM_AUTH_KEY_BYTES = 32`. The exact salt is `LP(CLAIM_AUTH_SALT_DOMAIN) || LP(PAIRING_VERSION) || LP(NFC-UTF8(inviteSessionId)) || LP(u64be(expiresAtEpochMilliseconds)) || LP(ASCII(canonicalMacBaseURL))`; the exact `info` is `LP(CLAIM_AUTH_INFO_DOMAIN) || LP(PAIRING_VERSION)`; and the derivation is `HKDF-SHA256(IKM = pairingSecret, salt = claimAuthSalt, info = claimAuthInfo, L = CLAIM_AUTH_KEY_BYTES)`.
- Normatively, `claimAuthenticator` = HMAC-SHA256(`claimAuthKey`, `canonicalClaimTranscript`). The claim-authentication HKDF and handoff-encryption HKDF must use separate domain constants, input keying material, salt, and `info`; neither output may substitute for the other.

- The Mac owns the mutable QR-secret buffer from invite and claim authentication through sealing. It uses the secret only for claim-authentication HKDF and handoff-encryption HKDF and never logs it or includes it in a response or persistent general storage.
- Creating the encrypted verifier envelope neither transfers nor extends the raw
  `pairingSecret` lifetime: the Mac-owned mutable raw-secret buffer remains
  governed by the existing sealing and `ready` cleanup rules and is never
  reconstructed from the envelope.
- `claimAuthKey` is key-equivalent secret material. It is never logged, returned, or persisted in plaintext.
- After the first valid HMAC, one durable transaction atomically changes the
  outer state from `issued` to `authorizing`, binds the exact request and retry
  identity, allocates `claimId`, and moves the unique ownership or reference
  for the same immutable verifier ciphertext from the invite slot to the
  reservation slot without copying, re-deriving, or re-encrypting the key.
- Concurrent authenticated claims cannot create multiple reservations: exactly
  one compare-and-swap winner performs the ownership transfer, and every false
  or unknown outcome follows the single authoritative-reread rule; an invalid
  HMAC performs no mutation.
- If the first-claim compare-and-swap returns false, or its commit
  acknowledgement or outcome is unknown, the request performs exactly one
  authoritative durable reread before selecting any response; that reread,
  matching-generation and state validation, and state-dependent response
  selection execute inside one serializable transaction or record lock that is
  mutually exclusive with every revoke, lock, lost-device, capability, expiry,
  ready-window deadline, and terminal-cleanup compare-and-swap.
- The transaction's reread-and-response-authorization creation is the
  linearization point: if a terminal or trusted-security transition linearizes
  first, the request creates no send authorization and returns the generic
  authentication failure; if response authorization creation linearizes first,
  that authorization permits only its bound exact serialized response bytes to
  be sent once and cannot be retroactively revoked.
- Only a winning reservation whose immutable verifier provenance ID and
  envelope generation both match the candidate invite envelope is a matching
  winner.
- When that single reread proves a matching winner, that reservation is the
  sole durable truth and the request applies the existing byte-identical or
  different-valid retry semantics to it.
- If the reread finds no winning reservation, a terminal tombstone, a missing
  record, a verifier provenance or generation mismatch, or cannot prove the
  matching winner, the request returns the generic authentication failure with
  no mutation, state disclosure, or verifier reconstruction.
- The same single-reread rule resolves invitation expiry, revoke, process
  restart, and persistence races; an unknown commit followed by a matching
  reservation uses that reservation as the only durable truth, and every other
  result fails closed.
- After leaving the transaction, consume the request-local send authorization
  at most once and send only its bound exact serialized response bytes without
  rereading or reselecting from an external stale snapshot; response
  transmission itself never holds the transaction or record lock.
- Every state-dependent response-selection path—the `sealing` to `ready` first
  sealed-response publication, each pre-deadline byte-identical `ready` retry,
  and the failed or unknown first-claim compare-and-swap reread path—executes
  inside one serializable transaction or record lock that is mutually exclusive
  with every trusted lock, revoke, lost-device, capability invalidation,
  expiry, ready-window deadline, and terminal-cleanup compare-and-swap.
- Inside that transaction, the request rereads and validates the current state,
  verifier provenance and generation, the applicable invitation expiry or
  immutable ready deadline, and exact retry identity before selecting exact
  serialized response bytes; response selection atomically creates an
  irrevocable, request-local, single-use send authorization bound only to those
  exact bytes, and authorization creation is the response operation's
  linearization point.
- If a terminal or trusted-security transition linearizes first, no send
  authorization is created, no sealed response is sent, and the request returns
  the generic authentication failure. If send authorization creation linearizes
  first, a later trusted transition still terminates the reservation immediately
  and prevents every future selection, retry, or authorization, but it cannot
  retroactively revoke that one already-authorized send; the actual socket or
  network send may occur after the later transition commits, so this authority
  makes no physical-send-order claim.
- For first publication, the same transaction persists `readyAt`, the immutable
  deadline, and the exact serialized sealed response, changes `sealing` to
  `ready`, and selects those exact response bytes from its durable write set.
  They become sendable only after the commit succeeds; a false or unknown
  outcome follows the existing authoritative-reread rule.
- For each pre-deadline byte-identical `ready` retry, the transaction selects
  only the retained exact serialized response bytes from the validated durable
  `ready` record.
- After the transaction, the request may consume the authorization at most once
  and send only its bound exact bytes; it never rereads or reselects durable
  state, substitutes different bytes, reuses the authorization, sends a stale
  in-memory sealed response, or holds the transaction or record lock during
  network I/O. Send failure or an unknown send outcome creates no second
  authorization and does not extend the retry window.
- The send authorization is an ephemeral request-local decision capability, not
  a durable outbox, acknowledgement, or recoverable send lease. A process crash
  before transmission may lose that response; restart never restores or replays
  the old authorization, and the client may submit the existing byte-identical
  retry to request a new authorization only if the reservation is still
  pre-deadline `ready` and no trusted transition has terminated it.
- Every terminal cleanup is one atomic, mutually exclusive, and idempotently
  recoverable transition that replaces the live outer record with a minimum
  tombstone containing no verifier and deletes the verifier ciphertext
  ownership or reference in the same commit.
- Restart recovery may safely repeat that transition and must never leave both
  a live verifier and a terminal tombstone.
- At atomic `ready`, the sealed byte-identical response, minimum retry identity, and encrypted `claimAuthKey` are durable. The raw `pairingSecret` is best-effort cleared immediately when the record enters `ready` rather than retained through the 30-second retry window. The encrypted `claimAuthKey` remains only through the ready retry window so the Mac can authenticate a different transcript before returning `handoff_consumed` and can reject an invalid authenticator generically without mutation.
- The exhaustive classification above is the sole terminal-state mapping; no failure class outside it may own a terminal mutation. At the immutable deadline, one atomic `ready` to `consumed` transition clears the retained sealed response, retry identity, and encrypted `claimAuthKey` and leaves only the minimum durable identifiers and consumed tombstone required for replay rejection.
- Every pre-ready terminal path above clears `claimAuthKey` and the reservation's other owned secret material while preserving required terminal tombstones; the ready-window deadline instead clears the retained sealed response, retry identity, and encrypted `claimAuthKey` while preserving the consumed tombstone.
- Invitation expiry, lock, revoke, lost-device, capability invalidation,
  persistence failure, or restart before `ready` uses that atomic tombstone
  transition to remove the unique verifier ciphertext ownership or reference
  and clear its `claimAuthKey` as applicable, while preserving only the minimum
  terminal tombstone required to fail closed.
- The iOS scanner or parser owns the received secret initially, then transfers ownership exactly once to the pending import operation. The operation derives `claimAuthKey`, uses it only for claim HMAC, and retains the raw secret only for handoff HKDF/AEAD open; it never persists or logs either. iOS clears `claimAuthKey` after serializing the exact retry request and holds the raw secret only until response authentication and open succeed and the encrypted received-vault plus both consumed IDs commit atomically, then clears it immediately. Cancel, parse, authentication, open, import, or persistence error, expiry, or restart before commit clears every owned raw or derived secret and requires a fresh invite.
- Cleanup is best-effort cleanup of owned mutable buffers, not guaranteed Swift runtime zeroization.

Do not copy the foundation version's `current/unuvault/mac-companion-pairing-approval-v2`, `omeJE`, `PbYrQ`, approved/promoted Pencil frame, or Argon2-as-pending statements.

- [ ] **Step 6: Route the recovered authority through current repo entrypoints**

Apply these bounded edits:

- `AGENTS.md` — in `## Design Authority`, add a route to the recovered spec labeled `Pairing V2 protocol/security semantics only`; state V2 implementation and exact-target security re-review remain pending and it is not broad Pencil/current-UI authority. Preserve current Mac frame `current/unuvault/mac-companion-core-flows-v1.3` and current iOS frames `current/unuvault/ios-product-composition-v1` / `current/unuvault/ios-pairing-invite-receive-v3`; do not add a pairing-approval frame.
- `README.md` — in `## Design Authority`, add the identical narrow route. In the current pairing-boundary proof paragraph, preserve the complete V1 import/reload facts and add the two explicit sentences `Pairing V1 remains the implemented proof boundary on main.` and `Pairing V2 implementation and exact-target security re-review remain pending.` Preserve PR `#79` runtime/observability wording and every current verification command.
- `apps/ios/README.md` — after the current V1 receive/import paragraph, add `The current V1 claim does not authenticate that claimant as the intended iPhone.` Then state that target-claim authentication, fresh Mac owner approval, persistent replay rejection, and no-downgrade semantics are pending in the recovered spec. Preserve v3 composition, physical-receipt limitation, local encrypted import/reload, and unclaimed camera/full-mobile boundaries.

- [ ] **Step 7: Rewrite the six architecture/launch/security packet documents from current main**

Make surgical edits; do not replace these files with their foundation versions.

- `docs/architecture/0005-secure-password-crypto.md`
  - Preserve `## Bounded Argon2 Policy` and its exact `opsLimit = 2`, `memLimit = 67_108_864`, version 19, and pre-allocation validation facts.
  - Add `## Two Crypto Substrates`: JS/Web/browser/CLI historical substrate versus native Mac/iOS P256/HKDF/AES-GCM pairing substrate.
  - Under `## Residual Risks`, state that Pairing V2 target authentication/owner authorization/replay, local bridge authorization, exact-target re-review, and independent review are separate open boundaries.
- `docs/launch/phase1-launch-checklist.md`
  - Preserve completed historical evidence and current PR `#79` observability routing.
  - Under `## Carry-Forward Before GA/Public Launch`, record `Current preliminary cross-platform review verdict: blocked`, list the four implementation blockers plus exact-target and independent review, and scope PR `#59` clearance to its recorded target.
  - Do not mark any new item complete.
- `docs/operations/crypto-review-gate.md`
  - Keep `## Bounded Argon2 Checkpoint` as resolved.
  - Add a current status table containing the exact status strings from Step 2.
  - Rename the old result section `## Historical Internal Iterative Review Status`; keep PR `#59`/`46ae...` evidence there.
  - State the current expanded gate is blocked until remediation and one exact merged-SHA re-review; any renewed exception must be for that exact target.
- `docs/operations/crypto-review-launch-exception.md`
  - Rename `## Current Exception Status (2026-04-25)` to `## Historical Exception Status (2026-04-25)`.
  - Preserve owner, PR `#59`, merge SHA, and recorded target.
  - State the exception does not authorize later native/cross-platform Pairing V2, independent-security, whole-product, paid/public-launch, or exact-target review claims.
- `docs/operations/secure-crypto-pr-audit-handoff.md`
  - Preserve the bounded Argon2 evidence and mark it `resolved`.
  - Replace `at or after` target language with a historical PR `#59` section tied only to `46ae...`.
  - Add cross-platform preliminary findings: unauthenticated target claim, missing fresh owner approval, in-memory-only replay rejection, local bridge bearer mismatch; verdict `blocked`.
  - Record required remediation and a new review against one exact future merged SHA; state no independent verdict exists for expanded scope.
- `docs/operations/third-party-crypto-review-request.md`
  - Set `dispatch state: not dispatched` and `exact merged implementation SHA: not yet assigned`.
  - Scope the future packet to the remediated cross-platform boundary and both substrates.
  - State the historical PR `#59` target cannot substitute.
  - Keep a forwardable brief, operator checklist, reviewer-output schema, and result-recording steps, but forbid dispatch until the exact SHA is recorded and local remediation/re-review evidence is attached.

- [ ] **Step 8: Run focused GREEN and boundary checks**

Run:

```bash
corepack pnpm exec vitest run tests/launch-packet-contract.spec.ts tests/workspace-entrypoints.spec.ts
git diff --name-only 16b0bfe3734cb2aa5233710e09b6b25684a5408e...HEAD
git diff --name-only
git diff --check
```

Expected: focused tests pass; `git diff --name-only` across the PR contains the approved design/plan evidence plus exactly the twelve implementation targets; the unstaged implementation diff contains only those twelve targets; `git diff --check` is silent.

- [ ] **Step 9: Run the UnuVault repo gates**

Run serially because the repo test runner owns a shared lock:

```bash
corepack pnpm lint
corepack pnpm test
```

Expected: both exit `0`. Preserve conditional skips as skips; do not report them as passes. This documentation-only task does not run physical-device, secret-backed, signing, or release-heavy paths.

- [ ] **Step 10: Commit the complete green slice**

Run:

```bash
git add AGENTS.md README.md apps/ios/README.md \
  docs/architecture/0005-secure-password-crypto.md \
  docs/launch/phase1-launch-checklist.md \
  docs/operations/crypto-review-gate.md \
  docs/operations/crypto-review-launch-exception.md \
  docs/operations/secure-crypto-pr-audit-handoff.md \
  docs/operations/third-party-crypto-review-request.md \
  docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md \
  tests/launch-packet-contract.spec.ts tests/workspace-entrypoints.spec.ts
git diff --cached --name-only
git commit -m "docs: recover pairing security authority"
git status --short
```

Expected: the staged list is exactly the twelve implementation targets; commit succeeds; worktree is clean.

- [ ] **Step 11: Independently review Task 1 before any remote mutation**

Prepare a review package containing:

```bash
git log --oneline 16b0bfe3734cb2aa5233710e09b6b25684a5408e..HEAD
git diff --stat 16b0bfe3734cb2aa5233710e09b6b25684a5408e...HEAD
git diff --check 16b0bfe3734cb2aa5233710e09b6b25684a5408e...HEAD
git status --short --branch
```

The reviewer must trace every approved recovery-design rule to the twelve-file diff, confirm current-main facts were retained, confirm no excluded file/frame/receipt was restored, and return `APPROVED` or concrete findings. Fix findings in the same Task 1 slice, rerun focused/full gates, commit the fix, and repeat review until approved.

Do not push, open PR A, or merge without the applicable user approval. After PR A is approved and merged, record its exact PR number and merged `main` SHA for Task 2; that merge SHA is authority-recovery evidence, not the future Pairing V2 implementation review target.

---

### Task 2: Register The Narrow Authority In UnuOS

**Files:**
- Modify: `/Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory/docs/portfolio/design-specs-inventory.md`

**Interfaces:**
- Consumes: merged PR A on `unuvault/main`, with the recovered spec and both repo-local routes present.
- Produces: one `current-routed` portfolio row scoped to Pairing V2 protocol/security semantics only, while preserving historical snapshot date/count evidence.

- [ ] **Step 1: Wait for PR A merge, then refresh the clean unuOS branch**

Verify the merged `unuvault/main` file before editing `unuOS`:

```bash
git -C /Users/yuchen/Code/unu/unuvault fetch origin
git -C /Users/yuchen/Code/unu/unuvault show origin/main:docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md | \
  rg -F "approved protocol/security design; implementation on main pending; exact-target security re-review pending"
cd /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory
test "$(git branch --show-current)" = "codex/unuvault-pairing-authority-inventory"
test -z "$(git status --short)"
git fetch origin
git merge --ff-only origin/main
git rev-parse HEAD
```

Expected: the spec exists on `unuvault/origin/main`; the `unuOS` branch is clean and fast-forwards to the then-current `origin/main`. Stop if PR A is not merged, the spec marker is absent, or fast-forward is impossible.

- [ ] **Step 2: Prove the exact inventory row is RED without adding a fourteenth tracked file**

Run this inline contract against the unchanged inventory:

```bash
.venv/bin/python - <<'PY'
from pathlib import Path

text = Path("docs/portfolio/design-specs-inventory.md").read_text(encoding="utf-8")
row = "| `unuvault` | `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md` | `unuvault/README.md` and `unuvault/AGENTS.md` | Pairing V2 protocol/security semantics only; implementation and exact-target re-review remain pending; no broad Pencil or current UI authority. |"
assert text.count(row) == 1, "recovered Pairing V2 current-routed row is absent"
PY
```

Expected: FAIL with `AssertionError: recovered Pairing V2 current-routed row is absent`. This inline assertion is the semantic RED because the approved write set permits only the inventory document in `unuOS`; do not add or modify a tracked test file.

Also record the pre-edit structural baseline:

```bash
PYTHONPATH=src .venv/bin/python -m unuos.cli check --root . --only design-governance-check --json
```

Expected: the existing structural machine guard passes before the row edit. The planning baseline was `pass`, one check, zero failures, zero warnings. The exact-row inline assertion supplies RED; the existing `design-governance-check` supplies the authoritative structural GREEN gate.

- [ ] **Step 3: Add exactly one current-routed row and clarify the snapshot exception rule**

In `docs/portfolio/design-specs-inventory.md`:

1. Add this exact row immediately after the existing `unuvault` product-scope row in `## Current-Routed Specs`:

```markdown
| `unuvault` | `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md` | `unuvault/README.md` and `unuvault/AGENTS.md` | Pairing V2 protocol/security semantics only; implementation and exact-target re-review remain pending; no broad Pencil or current UI authority. |
```

2. Immediately before `Current tracked snapshot:`, add these exact sentences:

```markdown
The table below remains a dated `2026-05-21` snapshot. Current-routed exceptions, including post-snapshot routes, are defined by the live `Current-Routed Specs` table above rather than by hard-coded exception wording in the snapshot rows.
```

3. Keep `Snapshot date: 2026-05-21.`, the `unuvault | 46` count, and `Total tracked mainline design specs in this snapshot: 381.` unchanged.
4. Change the `unuvault` snapshot-row boundary from `except the product-scope spec routed above` to `current-routed exceptions are defined by the live table above`; do not recount historical specs.

- [ ] **Step 4: Run semantic and structural GREEN**

Rerun the exact inline Python assertion from Step 2, then run:

```bash
PYTHONPATH=src .venv/bin/python -m unuos.cli check --root . --only design-governance-check --json
.venv/bin/pytest -q tests/test_design_governance_check.py tests/test_docs_smoke.py::test_design_authority_routes_pencil_first_shared_primitives
git diff --check
git diff --name-only
```

Expected: inline assertion passes; design-governance check reports `pass` with zero findings; targeted pytest passes (planning baseline: `40 passed`); diff check is silent; the only changed file is `docs/portfolio/design-specs-inventory.md`.

- [ ] **Step 5: Run the unuOS standard gate**

Run:

```bash
.venv/bin/pytest -q
git diff --check
```

Expected: full pytest exits `0`; `git diff --check` is silent. Do not run `Live Portfolio Check` or claim live cross-repo evidence; this task uses checked-out repo evidence and the single-repo `unuOS` gate.

- [ ] **Step 6: Commit the complete green inventory slice**

Run:

```bash
git add docs/portfolio/design-specs-inventory.md
git diff --cached --name-only
git commit -m "docs: register unuvault pairing security authority"
git status --short
```

Expected: exactly one staged file; commit succeeds; worktree is clean.

- [ ] **Step 7: Independently review Task 2 before remote mutation**

Review against the Task 2 execution base (the exact `origin/main` SHA recorded after the fast-forward):

```bash
git diff --stat "$(git merge-base HEAD origin/main)"...HEAD
git diff --check "$(git merge-base HEAD origin/main)"...HEAD
git show --stat --oneline HEAD
git status --short --branch
```

The reviewer must confirm: PR A is merged; the row path/routes/scope are exact; no broad Pencil/UI claim exists; `2026-05-21`, `46`, and `381` are unchanged; only the one approved file changed. Record the merge-base printed by `git merge-base HEAD origin/main` in the review receipt. Fix and re-review any finding before push or PR creation.

Do not push, open PR B, or merge without the applicable user approval.

---

### Task 3: Coordinate Cross-Repo Verification, Review Handoff, And Closeout Boundaries

**Files:**
- No semantic file changes.
- Read: both task branches, the approved recovery design, current PR metadata, and the retained foundation line.

**Interfaces:**
- Consumes: independently approved green commits from Tasks 1 and 2.
- Produces: current-head verification evidence, two PR handoffs, merge/rollback order, and an explicit post-merge salvage gate.

- [ ] **Step 1: Re-run current-head focused and standard gates in both worktrees**

UnuVault:

```bash
cd /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery
corepack pnpm exec vitest run tests/launch-packet-contract.spec.ts tests/workspace-entrypoints.spec.ts
corepack pnpm lint
corepack pnpm test
git diff --check 16b0bfe3734cb2aa5233710e09b6b25684a5408e...HEAD
git status --short --branch
```

UnuOS, using the exact Task 2 base SHA recorded during Task 2:

```bash
cd /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory
PYTHONPATH=src .venv/bin/python -m unuos.cli check --root . --only design-governance-check --json
.venv/bin/pytest -q
git diff --check "$(git merge-base HEAD origin/main)"...HEAD
git status --short --branch
```

Expected: all gates pass, both worktrees are clean, and any skipped checks remain reported as skipped rather than passed. Substitute the exact recorded Task 2 base SHA before running its diff check.

- [ ] **Step 2: Run cross-repo authority and exclusion assertions**

Run:

```bash
rg -n -F "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md" \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/AGENTS.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/README.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/apps/ios/README.md \
  /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory/docs/portfolio/design-specs-inventory.md

if rg -n "current/unuvault/mac-companion-pairing-approval-v2|omeJE|PbYrQ|share one crypto substrate|at or after.*46ae0c655deef0ef15cb0cd180b4844a32cac43d" \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/AGENTS.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/README.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/crypto-review-gate.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/crypto-review-launch-exception.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/secure-crypto-pr-audit-handoff.md \
  /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery/docs/operations/third-party-crypto-review-request.md; then
  exit 1
fi

test "$(rg -c '^Snapshot date: 2026-05-21\.$' /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory/docs/portfolio/design-specs-inventory.md)" -eq 1
test "$(rg -c '^\| `unuvault` \| 46 \|' /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory/docs/portfolio/design-specs-inventory.md)" -eq 1
```

Expected: the first search finds all four routes; the forbidden search exits `1` with no matches; both historical snapshot assertions pass.

- [ ] **Step 3: Verify exact range and file boundaries**

Run:

```bash
git -C /Users/yuchen/Code/unu/unuvault/.worktrees/pairing-security-authority-recovery diff --name-status 16b0bfe3734cb2aa5233710e09b6b25684a5408e...HEAD
git -C /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory diff --name-status "$(git -C /Users/yuchen/Code/unu/unuOS/.worktrees/unuvault-pairing-authority-inventory merge-base HEAD origin/main)"...HEAD
```

Expected: UnuVault contains the approved design, this plan, and exactly the twelve implementation files; unuOS contains exactly `docs/portfolio/design-specs-inventory.md`. No code, Mac receipt, plan from `0895919`, PNG, Pencil asset, runner, or unrelated doc is present.

- [ ] **Step 4: Obtain final security-aware review**

Give the reviewer:

- approved recovery design path and commit
- both exact base/head SHAs
- both name-status and full diffs
- focused and standard verification outputs
- RED/GREEN evidence from Tasks 1 and 2
- the exclusions and delivery/rollback order

The reviewer must verify requirement traceability, historical/current truth, V1/V2 separation, review-target immutability, absence of independent-review claims, no UI/Pencil authority change, and exact file boundaries. Resolve all findings and rerun affected gates before declaring either branch merge-ready.

- [ ] **Step 5: Prepare PR A handoff and preserve the bounded drift statement**

PR A handoff must include these sections from the shared template:

- `Summary`: restores narrow Pairing V2 protocol/security authority; no implementation/UI/Pencil/live-review work.
- `Verification`: focused contract command, `pnpm lint`, `pnpm test`, `git diff --check`, final reviewer status.
- `Design Gate`: `no-ui-impact`; Pencil operations `not applicable`.
- `Security Boundary`: V1 current, V2 pending, Argon2 resolved, bridge/replay/re-review/independent review open.
- `Cross-Repo Follow-Up`: PR B remains required; bounded inventory drift exists after PR A merge.
- `Rollback`: normal reviewed revert of PR A if PR B cannot be completed; no force push.
- `Post-Merge Closeout`: do not delete foundation; record merged SHA and start PR B from current `unuOS/main`.

- [ ] **Step 6: Prepare PR B handoff only after PR A is merged**

PR B handoff must include:

- exact merged PR A URL/SHA and proof that the spec is on `unuvault/main`
- one-file inventory diff and exact narrow scope
- preservation of `Snapshot date: 2026-05-21`, `unuvault | 46`, and total `381`
- design-governance and pytest evidence
- `Design Gate`: tracked authority registration only; no Pencil/local-asset mutation
- rollback order: revert the `unuOS` inventory row first, then PR A if the complete authority recovery must be rolled back
- `Post-Merge Closeout`: both PRs must be merged and final salvage must be approved before foundation cleanup

- [ ] **Step 7: Stop at remote/destructive approval boundaries**

Do not infer authorization for push, PR readiness, merge, rebase after remote divergence, branch deletion, worktree removal, or foundation cleanup. Request the relevant approval at each boundary. After both PRs merge, perform a fresh read-only salvage audit of `codex/api-observability-foundation`; delete it only if that audit proves no unique authority/evidence remains and the user separately approves deletion.

## Rollback Summary

- Before merge: close the affected PR and discard only its isolated task branch/worktree after explicit cleanup approval; keep foundation untouched.
- PR A merged / PR B not merged: finish PR B or revert PR A through a normal reviewed revert.
- Both merged: revert the `unuOS` inventory row first, then revert the `unuvault` source authority.
- Never use force push, protected-branch direct mutation, secret-backed execution, or destructive foundation cleanup as rollback.

## Post-Merge Closeout Checklist

- [ ] Record PR A URL, merge SHA, and final verification/review evidence.
- [ ] Record PR B URL, merge SHA, and final verification/review evidence.
- [ ] Confirm `origin/main` in both repos contains the intended authority and inventory row.
- [ ] Confirm both task worktrees are clean before any cleanup request.
- [ ] Run a fresh read-only salvage comparison against `codex/api-observability-foundation`.
- [ ] Classify foundation as retained or cleanup-eligible; do not delete without explicit approval.
- [ ] Remove task branches/worktrees only after merge and explicit lifecycle approval.
