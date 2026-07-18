# Pairing Security Authority Recovery Design

> Status: approved design for a documentation-and-contract recovery. This
> design does not implement Pairing V2, approve a UI, dispatch a security
> review, or authorize deletion of the retained foundation line.

This tracked file is the normative Pairing security authority-recovery design.
Historical commits are provenance only and cannot override later reviewed
amendments to this file.

## Context And Current Evidence

PR `#79` has merged the clean API observability extraction into `main`. The
current `origin/main` at the start of this design is
`16b0bfe3734cb2aa5233710e09b6b25684a5408e`.

The retained `codex/api-observability-foundation` line still contains commit
`08959197b620737f5a692b45c9a9cd59aeb79d82` (`feat: rebaseline ios vault and
security readiness`). That commit mixes several unrelated categories:

- the approved Pairing V2 protocol/security design and security-packet truth
- later-superseded iOS product code and tests
- historical UI/Pencil evidence
- stale implementation plans
- a Mac distribution-readiness receipt
- unrelated documentation and test-runner changes

The mixed commit cannot be cherry-picked. Restoring it wholesale would regress
facts that landed on `main` after the foundation line diverged, revive stale
plans and product code, and incorrectly restore historical UI/Pencil authority.
The recovery must therefore start from current `main` and reapply only the
approved protocol/security authority through a narrow, manually reviewed
write set.

## Goals

1. Restore one current-routed, narrow Pairing V2 protocol/security design to
   `unuvault/main`.
2. Make the current Pairing V1 implementation boundary and the future Pairing
   V2 target unambiguous.
3. Correct the security packet so the 2026-04 PR `#59` review stays historical
   and later native/cross-platform blockers remain open.
4. Preserve the implemented bounded Argon2 policy as resolved without using it
   to clear Pairing V2 or the broader security-review gate.
5. Add contract tests that prevent authority, launch, and review-target wording
   from drifting again.
6. Register the recovered spec as a narrow `current-routed` authority in the
   tracked `unuOS` design-spec inventory without rewriting its historical
   snapshot counts.
7. Make the retained foundation line eligible for a separate final salvage and
   cleanup decision only after both repositories have merged the recovery.

## Non-Goals

- no Pairing V2 product implementation
- no change to Mac, iOS, Web, API, browser-extension, or security-package code
- no restoration of stale implementation plans, screenshots, PNG evidence, or
  historical receipt files
- no restoration of the old Mac distribution-readiness receipt
- no signing, notarization, physical-device run, live credential use, or
  external-review dispatch
- no claim that Pairing V2, local bridge authorization, persistent replay
  rejection, third-party review, or public-launch security approval is complete
- no UI structure, interaction, accessibility, visual hierarchy, or Pencil
  authority change
- no deletion, force update, push, PR merge, or cleanup of the retained
  foundation line as part of the recovery implementation

## Exact Recovery Scope

The implementation write set is exactly twelve files in `unuvault` and one
file in `unuOS`. The recovery design spec itself is planning evidence and is
not counted among those thirteen implementation targets.

### UnuVault Source-Authority PR: Twelve Files

| File | Required role |
| --- | --- |
| `AGENTS.md` | Route security/protocol work to the recovered narrow spec. State that implementation and security re-review remain pending. Do not restore the historical pairing-approval frame as current UI authority. |
| `README.md` | Add the same narrow protocol/security route while preserving all current `main` product and verification facts, including current iOS import/product-composition and PR `#79` observability facts. Keep Pairing V1 as the implemented boundary and V2 as pending. |
| `apps/ios/README.md` | Describe the current V1 receive/open/encrypted-import/read-only-metadata boundary truthfully, record why V1 is not authenticated whole-vault pairing, and route to the pending V2 security design. |
| `docs/architecture/0005-secure-password-crypto.md` | Describe the two crypto substrates and their trust boundary. Preserve the implemented bounded Argon2 policy. Record Pairing V2, bridge authorization, persistent replay, and re-review as separate open work. |
| `docs/launch/phase1-launch-checklist.md` | Preserve historical launch evidence while reopening the cross-platform crypto/security gate for the current native boundary. Do not convert historical clearance or an old exception into current approval. |
| `docs/operations/crypto-review-gate.md` | Separate historical PR `#59` clearance from the current expanded review target. Preserve the resolved Argon2 checkpoint and list the remaining Pairing/bridge/replay/review blockers. |
| `docs/operations/crypto-review-launch-exception.md` | Scope the 2026-04 exception to its historical target. State that it cannot authorize the later native/cross-platform boundary and that a new decision follows the new exact-target review. |
| `docs/operations/secure-crypto-pr-audit-handoff.md` | Preserve the current bounded Argon2 evidence, add the cross-platform preliminary findings and remediation/re-review boundary, and prevent historical PR `#59` evidence from being relabeled as current clearance. |
| `docs/operations/third-party-crypto-review-request.md` | Rewrite the packet for future cross-platform dispatch. Keep it `not dispatched`, require one exact merged SHA for the remediated boundary, and forbid use of the historical PR `#59` target as a substitute. |
| `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md` | Restore a revised narrow protocol/security authority. Remove historical UI/Pencil authority claims and represent Argon2 as already resolved on `main`, not as pending Pairing implementation work. |
| `tests/launch-packet-contract.spec.ts` | Enforce historical-vs-current review scope, open blocker truth, exact-target dispatch rules, the resolved Argon2 boundary, and the absence of false independent-review or launch-clearance claims. |
| `tests/workspace-entrypoints.spec.ts` | Enforce the repo-local route to the recovered spec and the V1/V2 boundary without reintroducing old frame names, stale iOS assertions, test-runner changes, or unrelated contract coverage. |

The old Mac distribution receipt is deliberately excluded. It is not required
to make the Pairing V2 protocol/security authority self-contained, and its
credentials/signing state is a separate release lane.

### UnuOS Inventory-Sync PR: One File

| File | Required role |
| --- | --- |
| `docs/portfolio/design-specs-inventory.md` | Add the recovered Pairing V2 spec as a `current-routed` `unuvault` authority for protocol/security semantics only. Explicitly deny broad Pencil or current UI authority. Preserve the `2026-05-21` snapshot date and the historical `46` count instead of mechanically recounting it. Correct the `unuvault` exception wording so the current-routed table, rather than one hard-coded exception, defines the active exceptions. |

## Current Pairing V1 Boundary

The recovery must describe current `main` as it exists, not as the foundation
branch once described it:

- the iOS package parses the existing invite, submits a claimant-provided
  identity to `/v1/pairing/claim`, opens the claimant-key-bound AES-GCM handoff,
  stores it in the encrypted received-vault store, reloads it, and projects
  read-only metadata
- the current proof keeps password and vault plaintext out of UI metadata and
  claim/response logs
- the recorded 2026-07-08 physical receipt remains transport/target-identity
  evidence only; it does not become a physical local-import receipt
- V1 does not authenticate that the claimant key belongs to the intended target
  device and does not provide the required fresh Mac owner approval for a
  production whole-vault transfer
- V1 remains the implemented proof boundary on `main`; this documentation
  recovery neither removes it nor upgrades its security claim

## Approved Pairing V2 Protocol/Security Semantics

The recovered `2026-07-10` spec is authoritative only for the following narrow
future target. Its status is `approved protocol/security design; implementation
on main pending; exact-target security re-review pending`.

### Target-Claim Authentication

- The QR invitation carries a fresh 32-byte `pairingSecret` through the trusted
  camera channel.
- iOS generates a fresh target P256 key agreement identity and client nonce.
- `claimAuthKey` is a 32-byte, session-bound, domain-separated key derived from
  the raw `pairingSecret` with HKDF-SHA256. Its salt binds the Pairing version,
  invitation session, expiry, and canonical Mac base URL; its `info` uses the
  dedicated `unuvault-pairing-claim-auth-key-v2` domain. These invitation-owned
  inputs do not depend on target-controlled claim fields or the authenticator.
- Normatively, `claimAuthenticator` = HMAC-SHA256(`claimAuthKey`,
  `canonicalClaimTranscript`). Claim authentication and handoff encryption use
  distinct domains, salt, `info`, and input keying material.
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
- The transcript uses one normative binary length-prefix encoding, fixed domain
  separation, fixed field order, strict canonical base64url, exact DER
  round-tripping, NFC UTF-8 text, canonical epoch milliseconds, and a bounded
  canonical LAN base URL.
- The Mac recomputes the target fingerprint from the submitted canonical DER,
  verifies the HMAC in constant time, and returns one generic authentication
  failure. Client echoes never override invitation-owned fields.
- The claim-validation pipeline is normative and ordered:
  1. Enforce the raw HTTP entity-body cap of 4096 octets. Reject
     `Content-Length` greater than 4096 before reading; for chunked or
     unknown-length input, use one fixed bounded buffer and fail closed when
     the 4097th octet arrives.
  2. Perform JSON parsing, schema validation, strict base64url decoding, and
     required-field checks.
  3. NFC-normalize text and enforce UTF-8 lengths of 1–128 bytes for
     `targetDeviceId` and 1–256 bytes for `targetDisplayName`.
  4. Parse the target P256 SPKI DER and require canonical DER by exact
     re-serialization before accepting the public key.
  5. Perform constant-shape verifier retrieval keyed only by the server-owned
     `inviteSessionId`: make one bounded indexed verifier-record read; decrypt
     the live encrypted `claimAuthKey` when present; for an absent, terminal,
     non-live, or missing record, substitute an independent 32-byte
     process-owned dummy key and continue through the same HMAC path. This step
     makes no reservation-lifecycle or state-dependent response decision,
     never returns or logs the candidate key, and never recreates a terminal
     verifier. It does not claim perfect constant-time storage I/O;
     it requires only a fixed bounded response and computation shape with one
     generic external result.
  6. Compute HMAC-SHA256 with the candidate key and compare the supplied
     authenticator in constant time.
  7. Only when the HMAC authenticates with a live verifier, load the full
     reservation state and apply the exact-retry, different-valid-retry, and
     ready-security-invalidation rules. A dummy-key or invalid-authenticator
     path returns the same generic authentication failure with no state
     disclosure or mutation.
- Verifier retrieval is a minimal capability-key lookup, not an authenticated
  business-state lookup; the latter occurs only after HMAC authentication
  succeeds with a live verifier.
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
- Public invite fields, source IP, display name, the target-provided
  fingerprint, or LAN reachability are not authentication.

### Fresh Mac Owner Authorization

- The Mac must show the target device identity and request expiry before any
  vault read.
- Each `Confirm & send` attempt creates a fresh `LAContext` and evaluates
  `deviceOwnerAuthentication`, allowing Touch ID or the Mac login password.
- An existing unlocked-vault session is necessary but not sufficient.
- After successful authentication, the Mac rechecks session identity, target,
  expiry, lock/revoke/lost-device state, and capability before reading exactly
  one in-memory vault snapshot.
- Fresh owner denial or cancellation records terminal `denied`.
  Owner-authentication unavailability or `LAContext` evaluation or system
  error records terminal `invalidated`. Either path creates no handoff, logs
  no plaintext, and clears the reservation's owned raw and derived secrets.
- Changed state or read failure also creates no handoff and logs no plaintext.

### Target-Bound Handoff

- The Mac uses a fresh ephemeral P256 key and P256 ECDH with the target key.
- HKDF-SHA256 derives the handoff key using the QR-secret-bound canonical salt
  and the exact session/claim/target/ephemeral context.
- AES-GCM seals one versioned vault snapshot with canonical associated data.
- The wire algorithm identifier remains
  `P256-HKDF-SHA256-AES-GCM-256-V2`.
- The public response contains only the fields required to reconstruct key
  derivation and associated data. It never carries the QR secret, private keys,
  derived key, capability, or plaintext credentials.

### Single Use, Persistent Replay Rejection, And No Downgrade

- A first valid claim creates one atomic reservation. Only the reserved byte-identical retry may observe pending or ready behavior.
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
- The transaction's reread-and-response-decision point is the linearization
  point: if a terminal or trusted-security transition linearizes first, the
  request returns the generic authentication failure; if authorized response
  selection linearizes first, that selected response is defined to precede any
  later revoke.
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
- After leaving the transaction, send exactly the selected response without
  rereading or reselecting from an external stale snapshot; response
  transmission itself never holds the transaction or record lock.
- An unauthenticated or malformed request receives the same generic authentication failure, with no state disclosure or mutation.
- A different valid authenticated retry identity while the encrypted `claimAuthKey` verifier exists after reservation receives terminal `handoff_consumed` and cannot mutate, replace, or extend the reservation.
- While an encrypted `claimAuthKey` verifier exists in `authorizing`, `sealing`, or pre-deadline `ready`, the Mac authenticates the canonical request before selecting a state-dependent response: the reserved byte-identical identity receives only its allowed pending or ready behavior, while a different valid authenticated identity receives `handoff_consumed`.
- An `inviteSessionId` lookup alone never authorizes `handoff_consumed`.
- After `consumed`, `denied`, `expired`, or `invalidated` clears the verifier, every request receives the generic authentication failure with no state disclosure or mutation, even when its `inviteSessionId` matches a terminal tombstone.
- The reserved byte-identical retry may receive the byte-identical sealed response during the bounded 30-second recovery window, but retry does not extend the invitation or retry-window deadline.
- The ready recovery window begins only when the durable reservation atomically transitions to `ready`; `readyAt` is the timestamp written by that same transaction, and the immutable deadline is `min(readyAt + 30 seconds, original invitation expiry)`.
- Before the immutable deadline, processing the initial response, a byte-identical retry, a different valid authenticated retry identity, or an invalid authenticator does not by itself transition `ready` to `consumed` or `invalidated`, move `readyAt`, or shorten or extend the window.
- An independent trusted local lock, revoke, lost-device, or capability invalidation event during `ready` atomically transitions the reservation to `invalidated` immediately and clears the retained sealed response, retry identity, and encrypted `claimAuthKey`; security revocation takes priority over the recovery deadline.
- iOS persists consumed `handoffId` and `claimId` records in the encrypted
  received-vault snapshot in the same atomic transaction as credential import.
- Replay rejection must survive app/process restart. An in-memory set is not
  sufficient.
- A V2 client must fail closed; it must not retry a failed V2 whole-vault
  transfer through V1. The Mac must not return whole-vault material for a V1
  claim once V2 is the production requirement.
- The current V1 proof remains available until implementation migration is
  separately approved, but it cannot be presented as the secure production
  fallback for V2.

### Terminal Cleanup And Bounded Recovery

- `consumed`, `denied`, `expired`, and `invalidated` are terminal states.
- Every terminal cleanup is one atomic, mutually exclusive, and idempotently
  recoverable transition that replaces the live outer record with a minimum
  tombstone containing no verifier and deletes the verifier ciphertext
  ownership or reference in the same commit.
- Restart recovery may safely repeat that transition and must never leave both
  a live verifier and a terminal tombstone.
- The normative state machine permits `invalidated` from `authorizing` or
  `sealing` for the terminal owners classified below, and from `ready` only for
  an independent trusted local lock, revoke, lost-device, or capability
  invalidation event.
- No other owner-authentication, internal, persistence, process, or
  request-processing outcome may transition `ready` early.
- The only state-owning terminal mutations are exclusive and classified as follows: fresh owner denial or cancellation records `denied`; invitation expiry records `expired`; owner-authentication unavailability or `LAContext` evaluation or system error records `invalidated`; lock, revoke, lost-device, or capability invalidation records `invalidated`, including an immediate atomic `ready` to `invalidated` transition for an independent trusted local lifecycle event; reservation identity, vault session identity, or authenticated-target recheck failure records `invalidated`, while expiry and lifecycle outcomes discovered by that recheck remain classified under their preceding categories; internal read or snapshot, key-derivation, sealing, persistence, or process failure before `ready` records `invalidated` when the worker can commit the terminal write; restart recovery of unfinished `authorizing` or `sealing` work records `invalidated` when a process failure prevented that write; and reaching the immutable ready-window deadline transitions `ready` to `consumed` only if no prior security invalidation occurred.
- An unauthenticated or malformed request receives the same generic authentication failure, with no state disclosure or mutation. A different valid authenticated retry identity while the encrypted `claimAuthKey` verifier exists after reservation receives terminal `handoff_consumed` and cannot mutate, replace, or extend the reservation. Only the reserved byte-identical retry may observe pending or ready behavior.
- Before the immutable deadline, processing the initial response, a byte-identical retry, a different valid authenticated retry identity, or an invalid authenticator does not by itself transition `ready` to `consumed` or `invalidated`, move `readyAt`, or shorten or extend the window.
- An independent trusted local lock, revoke, lost-device, or capability invalidation event during `ready` atomically transitions the reservation to `invalidated` immediately and clears the retained sealed response, retry identity, and encrypted `claimAuthKey`; security revocation takes priority over the recovery deadline.
- `claimAuthKey` is a 32-byte, session-bound, domain-separated key derived from the raw `pairingSecret` with HKDF-SHA256. Normatively, `claimAuthenticator` = HMAC-SHA256(`claimAuthKey`, `canonicalClaimTranscript`).
- The Mac owns the mutable QR-secret buffer from invite and claim authentication through sealing. It uses the secret only for claim-authentication HKDF and handoff-encryption HKDF and never logs it or includes it in a response or persistent general storage.
- Creating the encrypted verifier envelope neither transfers nor extends the raw
  `pairingSecret` lifetime: the Mac-owned mutable raw-secret buffer remains
  governed by the existing sealing and `ready` cleanup rules and is never
  reconstructed from the envelope.
- `claimAuthKey` is key-equivalent secret material. It is never logged, returned, or persisted in plaintext.
- At atomic `ready`, the sealed byte-identical response, minimum retry identity, and encrypted `claimAuthKey` are durable. The raw `pairingSecret` is best-effort cleared immediately when the record enters `ready` rather than retained through the 30-second retry window. The Mac retains the encrypted `claimAuthKey` only through the ready retry window so it can authenticate an arbitrary different transcript before returning `handoff_consumed`; invalid authenticators still receive the generic failure without mutation.
- The exhaustive classification above is the sole terminal-state mapping; no failure class outside it may own a terminal mutation. At the immutable deadline, one atomic `ready` to `consumed` transition clears the retained sealed response, retry identity, and encrypted `claimAuthKey` and leaves only the minimum durable identifiers and consumed tombstone required for replay rejection.
- Every pre-ready terminal path above clears `claimAuthKey` and the reservation's other owned secret material while preserving required terminal tombstones; the ready-window deadline instead clears the retained sealed response, retry identity, and encrypted `claimAuthKey` while preserving the consumed tombstone.
- Invitation expiry, lock, revoke, lost-device, capability invalidation,
  persistence failure, or restart before `ready` uses that atomic tombstone
  transition to remove the unique verifier ciphertext ownership or reference
  and clear its `claimAuthKey` as applicable, while preserving only the minimum
  terminal tombstone required to fail closed.
- The iOS scanner or parser owns the received secret initially, then transfers ownership exactly once to the pending import operation. The import derives `claimAuthKey`, uses it only for claim HMAC, and retains the raw secret only for handoff HKDF/AEAD open; it never persists or logs either. iOS clears `claimAuthKey` after serializing the byte-identical retry request and holds the raw secret only until response authentication and open succeed and the encrypted received-vault plus both consumed IDs commit atomically, then clears it immediately. Cancel, parse, authentication, open, import, or persistence error, expiry, or restart before commit clears every owned raw or derived secret and requires a fresh invite.
- Cleanup means best-effort cleanup of owned mutable buffers, not guaranteed zeroization of copies created by the Swift runtime.
- No terminal mutation permits downgrade, and every path preserves the durable reservation, replay, or terminal tombstone metadata required to fail closed.
- Recovery is bounded and fail-closed; it does not mint a new capability,
  extend the invite TTL, change the target, or permit downgrade.

### Separate Open Security Boundaries

- The predictable/mismatched local Web/extension bridge bearer contract remains
  a separate launch blocker. Pairing V2 does not silently solve it.
- The persistent replay ledger is part of Pairing V2 implementation and remains
  pending on `main`.
- The current bounded Argon2 policy is already implemented and documented. It
  is resolved for hostile parameter allocation, but it neither clears Pairing
  V2 nor creates an independent security verdict.
- After remediation, the exact final implementation commit must receive a new
  repo-backed cross-platform security review.
- A real independent third-party review must cover one exact merged SHA before
  any independent-security claim or higher-risk public/paid launch claim.

## Security Packet Rewrite Rules

All six architecture/launch/operations files must be edited from current
`main`. Copying their foundation versions wholesale is forbidden.

### Historical PR #59

- PR `#59`, merge commit
  `46ae0c655deef0ef15cb0cd180b4844a32cac43d`, remains historical evidence for
  its recorded Web/browser-extension/CLI JavaScript security substrate.
- The 2026-04 internal clearance and launch exception apply only to that exact
  historical target.
- Wording such as "at or after PR #59" must not expand that old evidence over
  later native Mac/iOS crypto surfaces.
- The old exception is not current Pairing V2, whole-product, independent, or
  public-launch approval.

### Current Open Status

The current packet must keep these statements simultaneously true:

- bounded Argon2 hostile-parameter handling is implemented and remains in the
  packet as a resolved checkpoint
- Pairing target-claim authentication is pending on `main`
- fresh Mac owner authorization for whole-vault transfer is pending on `main`
- restart-persistent iOS replay rejection is pending on `main`
- local bridge authorization remains a separate open blocker
- exact-target cross-platform security re-review is pending
- independent third-party review for the expanded scope is `not dispatched`

### Exact Future Review Target

- The authority-recovery PR is not the final Pairing V2 implementation target.
- After all security remediation is merged, the packet must record one exact
  merged `main` SHA before either internal exact-target re-review or external
  dispatch is represented as complete.
- Until that immutable SHA is known and recorded, the dispatch state remains
  `not dispatched`; the historical PR `#59` SHA cannot fill the field.
- The review request must not use an open range, a branch name, "latest main",
  or "at or after" language as the review target.
- A request document is preparation evidence only. It is not proof that a
  reviewer was assigned, credentials were used, the packet was sent, or a
  verdict exists.

### Preserve Later Main Facts

The manual rewrite must retain every relevant fact that landed after
`0895919`, including:

- the bounded Argon2 policy and legacy input bounds
- current iOS encrypted import, reload, read-only projection, and product
  composition evidence boundaries
- current browser-import and other security packet hardening
- current runtime/observability truth from PR `#79`
- current verification wrappers and test serialization

When old wording conflicts with current `main`, current `main` wins unless this
design explicitly changes the authority statement.

## Cross-Repo Authority Registration

The recovered repo-local spec becomes narrow current authority only when the
`unuvault` entrypoints route to it. The `unuOS` inventory then records the same
scope at portfolio level.

The new `current-routed` inventory row must say:

- repo: `unuvault`
- spec: `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`
- routed by: `unuvault/README.md` and `unuvault/AGENTS.md`
- scope: Pairing V2 protocol/security semantics only; implementation and
  exact-target re-review remain pending; no broad Pencil/current-UI authority

The inventory's `Snapshot date: 2026-05-21` and `unuvault | 46` count are
historical snapshot evidence. The implementation must not mechanically change
that count because a later spec is added. Instead it must clarify that the
snapshot table remains dated and that current-routed exceptions are defined by
the live table above it, including post-snapshot routes.

## Delivery Architecture

This recovery uses two independently reviewable PRs.

### PR A: UnuVault Source Authority

1. Start from the then-current `unuvault/main`.
2. Change exactly the twelve `unuvault` implementation files listed above.
3. Use contract tests to prove the route and packet semantics.
4. Run focused and full repo verification.
5. Obtain security-aware documentation review and merge the PR.

### PR B: UnuOS Inventory Sync

1. Start from the then-current `unuOS/main` after PR A merges.
2. Change only `docs/portfolio/design-specs-inventory.md`.
3. Add the narrow route and preserve the dated snapshot/count boundary.
4. Run targeted docs validation and the standard `unuOS` gate.
5. Merge immediately after PR A when review and verification pass.

This order intentionally creates a short bounded drift window: repo-local
authority exists after PR A, while the portfolio inventory still lacks the
route until PR B merges. The drift is preferable to an inventory entry that
points at a spec not yet present on `unuvault/main`. It must be called out in
both PR handoffs, kept as short as practical, and never used to justify
foundation cleanup before PR B completes.

### Rollback Order

- Before either merge, close the affected PR and discard only its isolated
  task line; the retained foundation stays untouched.
- If PR A merges but PR B does not, keep the foundation and either finish PR B
  or revert PR A through a normal reviewed revert.
- If both merge and the authority recovery must be rolled back, revert the
  `unuOS` inventory row first, then revert the `unuvault` source authority. This
  avoids a portfolio pointer to a missing source.
- Never roll back through force push, direct protected-branch mutation, or
  destructive foundation cleanup.

## Design Gate

Design Gate:

- UI impact: `none`
- Classification: `no-ui-impact`
- Design review: `not applicable`
- `ui-ux-pro-max`: `not applicable`
- Pencil current read: `not performed`
- Pencil current mutation: `not performed`
- Pencil draft mutation: `not performed`
- Pencil sync: `not applicable`
- Pencil lease: `not applicable`
- Approval-frame authority: `not restored`

Fresh LocalAuthentication, target identity presentation, denial, and recovery
are security protocol requirements here, not approval of a screen, layout,
copy treatment, or current Pencil frame. Any future material UI implementation
must enter the normal design/Pencil gate separately.

## Verification Plan

### PR A Focused Contract Gate

The implementation must first update the contract tests so they fail against
the pre-recovery authority, then make the documentation changes pass:

```bash
corepack pnpm exec vitest run \
  tests/workspace-entrypoints.spec.ts \
  tests/launch-packet-contract.spec.ts
```

The tests must positively enforce the new route and current/open status, and
must negatively reject:

- Pairing V2 implementation-complete wording
- stale V1 no-local-import wording
- historical approval-frame/Pencil authority
- historical PR `#59` as the current expanded target
- "at or after" review-target ranges
- a current third-party-review-deferred or independently-reviewed claim
- removal or reopening of the resolved bounded Argon2 checkpoint
- unrelated Mac receipt, plan, screenshot, product-code, or runner assertions

### PR A Standard Gate

```bash
corepack pnpm lint
corepack pnpm test
git diff --check
```

The full test run must use the current repository wrapper and report any
conditional native skips exactly as skips, not passes. No live credentials,
physical device, signing, notarization, external reviewer, telemetry provider,
or secret-backed path is required for this docs/contract recovery.

### PR B Gate

```bash
PYTHONPATH=src .venv/bin/python -m pytest tests/test_docs_smoke.py -q
.venv/bin/pytest -q
git diff --check
```

If the local `unuOS` environment lacks its documented `.venv`, setup must
follow that repository's current contributor authority before verification;
the command must not be silently replaced with an untracked ad hoc runner.

### Cross-Repo Read-Only Confirmation

After both merges, verify from fresh `main` checkouts that:

- both repo-local entrypoints route to the recovered spec
- the spec exists on `unuvault/main`
- the inventory contains exactly one narrow current-routed row
- the dated `46` snapshot count remains explicitly historical
- no UI/Pencil authority was added
- the foundation line was not used as an implementation base

## Review Requirements

PR A requires an independent final review focused on:

- requirement traceability across all twelve files
- security claim truthfulness
- preservation of post-foundation `main` facts
- historical PR `#59` and exception scoping
- exact-target review and dispatch semantics
- no secret, credential, or live-review claim

PR B requires a separate inventory/contract review after PR A merges. A passing
test suite cannot substitute for either review.

The future Pairing V2 implementation and its exact final commit require their
own security review. Approval of this authority recovery is not approval of
that implementation.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Old foundation text overwrites later `main` facts | Edit from current `main`; forbid cherry-pick and whole-file copy; review the final diff line by line. |
| Recovered spec is mistaken for shipped V2 | Use the explicit pending status in the spec, both entrypoints, security gate, checklist, and tests. |
| Historical PR `#59` clearance expands to native surfaces | Scope it to its exact SHA and recorded JS substrate; forbid ranges and current-clearance wording. |
| Resolved Argon2 work is accidentally reopened or deleted | Preserve the current bounded-policy checkpoint and test for it as resolved but non-clearing. |
| Cross-repo inventory points at a missing file | Merge `unuvault` first; merge `unuOS` immediately after; revert inventory first on rollback. |
| Dated inventory count drifts | Preserve `2026-05-21` and `46`; clarify the snapshot boundary instead of recounting. |
| UI/Pencil authority is revived accidentally | Keep the Design Gate explicitly no-impact and reject old frame/evidence routes in review/tests. |
| Request packet is mistaken for a dispatched review | Keep expanded status `not dispatched`; require a real reviewer path and exact merged SHA before dispatch claims. |
| Foundation is deleted before salvage is complete | Require both merges, fresh cross-repo verification, lifecycle closeout, and separate deletion approval. |

## Secret And Live-System Boundary

This work reads and writes tracked documentation and contract tests only. It
must not read, print, copy, validate, or store:

- QR/session secrets
- bridge bearer tokens
- Supabase keys
- signing or notarization credentials
- vault ciphertext or plaintext
- passwords, recovery material, reviewer contact credentials, or device-private
  keys

No command in this recovery proves a live reviewer assignment, external
dispatch, physical-device security result, credential-backed signing, hosted
state, or live production approval.

## Foundation Final Salvage And Cleanup

Until both PRs merge, `codex/api-observability-foundation` remains a read-only
`frozen-archive`; no new implementation may start from it.

After both merges:

1. Compare the foundation's remaining unique commits/files against the two
   merged recovery results and current `main`.
2. Confirm that the recovered protocol/security authority is complete and that
   the excluded receipt, stale plans, PNG evidence, and old product code have no
   separately approved salvage job.
3. Record the branch, worktree, owner, next action, local/remote decision, and a
   delete-by or review-by date in the accepted PR closeout or a tracked cleanup
   note.
4. Reclassify the line to `discard-candidate` only after that final salvage
   review.
5. Obtain explicit approval for destructive cleanup.
6. Remove the attached worktree and local/remote branch refs only through the
   repository lifecycle process; do not force-delete an unverified line.

If any unique authority is still unresolved, keep the line `frozen-archive`
with a named owner and next checkpoint. A merged recovery PR alone is not proof
that cleanup is complete.

## Acceptance Criteria

- The implementation is limited to the exact twelve `unuvault` files and one
  `unuOS` inventory file listed in this design.
- The recovered spec is narrow protocol/security authority with implementation
  and exact-target review pending.
- Current Pairing V1 facts remain accurate and are not promoted to production
  V2 security.
- Target-claim HMAC, canonical transcript, fresh LocalAuthentication,
  P256/HKDF/AES-GCM, single-use consume, persistent replay rejection, V1
  no-downgrade, terminal cleanup, and bounded recovery are explicit.
- Bounded Argon2 is recorded as implemented/resolved without clearing broader
  Pairing or review gates.
- PR `#59` and its exception remain historical; the expanded packet is not
  dispatched and requires one future exact merged SHA.
- Post-`0895919` facts on current `main` remain intact.
- The `unuOS` inventory adds one narrow current-routed row while preserving the
  dated `46` snapshot boundary.
- Both PRs receive their own current-head verification and review.
- No UI/Pencil, receipt, plan, PNG, product code, secret, credential, live
  reviewer, push, merge, or cleanup claim is introduced by the recovery spec.
- The foundation remains untouched until the final salvage and separately
  approved cleanup gate.
