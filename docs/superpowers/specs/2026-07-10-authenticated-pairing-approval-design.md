# Authenticated Pairing Approval Design

> Status: approved protocol/security design; implementation on main pending; exact-target security re-review pending.

## Purpose And Authority Boundary

This document is `current-routed` authority for Pairing V2 protocol/security
semantics only. It does not approve a screen, interaction layout, visual
hierarchy, accessibility treatment, Pencil frame, or other current UI state.

Pairing V1 is the implemented proof boundary on `main`. Pairing V2
implementation and an exact-target security re-review remain pending. Any
future UI implementation must separately pass the normal design/Pencil gate
before it can become current UI authority.

## Current V1 Boundary

The current iOS proof can:

- parse the Mac pairing invite envelope and QR payload
- submit a claimant-provided identity to `/v1/pairing/claim`
- open the claimant-key-bound AES-GCM handoff locally
- persist the received vault in the AES-GCM encrypted received-vault store
- perform a fresh reload from that store
- project read-only `label`, `username`, and `websiteOrigin` metadata without
  passwords

V1 does not authenticate that the claimant key belongs to the intended target
iPhone. It also does not require fresh Mac owner approval before a whole-vault
handoff. The current proof must not be described as authenticated production
pairing merely because the claimant can open material encrypted to the key it
submitted.

## Threat Model And Security Invariants

Pairing V2 assumes a hostile LAN and a racing local process that can observe,
repeat, reorder, or submit requests before the intended iPhone. The trusted
camera channel carrying a fresh secret is the target-authentication root.

The following are public or attacker-influenceable facts and are not
authentication:

- public invitation fields
- source IP address
- device display name
- a target-provided public-key fingerprint
- LAN reachability
- an existing unlocked-vault session

The Mac must authenticate the target claim, obtain fresh owner authorization,
bind the sealed handoff to that target, enforce single use across restarts, and
fail closed without downgrading to V1.

## Canonical Encoding

The normative length-prefix primitive is:

```text
LP(bytes) = u32be(byteLength) || bytes
```

Every variable-length transcript field is encoded with `LP`. Each transcript
has one fixed ASCII domain and one fixed field order; fields must never be
sorted, omitted, duplicated, or accepted through an alternate spelling.

The canonical claim transcript is the concatenation of these fields in order:

1. `LP(ASCII("unuvault-pairing-claim-v2"))`
2. `LP(NFC-UTF8(inviteSessionId))`
3. `LP(u64be(expiresAtEpochMilliseconds))`
4. `LP(ASCII(canonicalMacBaseURL))`
5. `LP(canonicalTargetIdentityDER)`
6. `LP(NFC-UTF8(targetDeviceId))`
7. `LP(NFC-UTF8(targetDisplayName))`
8. `LP(clientNonce)`

Binary fields use strict unpadded base64url on JSON/QR boundaries. A decoder
must reject padding, non-URL alphabet characters, non-minimal encodings, or any
value whose decode-and-re-encode result differs byte-for-byte from the input.
The P256 public key is accepted only when parsing and reserializing its
canonical DER produces the identical bytes. Human text is NFC-normalized UTF-8.
Time is an unsigned canonical epoch-millisecond value. The LAN URL must have a
supported scheme, a canonical host and explicit bounded port, no user info,
query, fragment, dot segments, or trailing alternate representation, and must
round-trip to one bounded canonical base URL.

The claim transcript owns the invite session, expiry, and Mac URL fields. A
client echo cannot replace any server-owned invitation value.

## Target-Claim Authentication

Each invitation contains a fresh cryptographically random 32-byte
`pairingSecret` delivered through the QR camera channel. The target creates a
fresh P256 key-agreement identity and a fresh client nonce for the claim.

The target sends:

```text
claimAuthenticator = HMAC-SHA256(pairingSecret, canonicalClaimTranscript)
```

The Mac reconstructs the transcript from server-owned invite fields plus the
submitted canonical target fields, recomputes the target fingerprint from the
canonical DER, and verifies the HMAC in constant time. Expired, malformed,
unknown-session, fingerprint-mismatch, transcript-mismatch, and HMAC-mismatch
paths return one generic authentication failure and disclose no comparison
detail.

## Fresh Mac Owner Authorization

Before any vault read, the Mac presents the authenticated target identity and
request expiry. Every `Confirm & send` attempt creates a fresh `LAContext` and
evaluates `deviceOwnerAuthentication`, allowing Touch ID or the Mac login
password according to the platform policy. An already unlocked vault session
is necessary but not sufficient authorization.

After successful authentication, the Mac rechecks the vault session identity,
authenticated target, expiry, lock state, revoked or lost-device state, and
the pending capability. Only then may it perform exactly one in-memory vault
snapshot read. Cancellation, denial, unavailable authentication, changed
state, or read failure creates no handoff and writes no plaintext to logs.

## Target-Bound Handoff

For each authorized handoff, the Mac creates a fresh ephemeral P256 key and
performs P256 ECDH with the authenticated target identity. HKDF-SHA256 derives
one 256-bit key from the ECDH secret with a QR-secret-bound canonical salt and
the fixed session, claim, target, and ephemeral-key context.

AES-GCM seals one versioned vault snapshot. Its canonical AAD binds the exact
algorithm identifier, protocol version, invite session, claim, handoff,
authenticated target identity, expiry, and ephemeral public key in a fixed
domain and field order. The algorithm identifier is exactly
`P256-HKDF-SHA256-AES-GCM-256-V2`.

The public response contains only the version, algorithm, identifiers, expiry,
canonical ephemeral public key, AES-GCM nonce, ciphertext, and fields required
to reconstruct the KDF context and AAD. It contains no `pairingSecret`, private
key, ECDH secret, derived key, capability, vault plaintext, credential
plaintext, or password.

## Single Use And Persistent Replay Rejection

Successful consume uses one atomic reservation. An authenticated retry with
the same nonce may receive the byte-identical sealed response for at most 30
seconds. A different nonce after reservation receives terminal
`handoff_consumed` and cannot replace or extend the reservation.

iOS must atomically persist the consumed `handoffId` and `claimId` in the
encrypted received-vault snapshot in the same transaction as credential
import. Rejection must survive app and process restart; an in-memory replay set
is insufficient.

A V2 client fails closed and must not retry a failed V2 whole-vault transfer
through V1. Once V2 is the production requirement, the Mac must not return
whole-vault material for a V1 claim.

## Terminal Cleanup And Bounded Recovery

`consumed`, `denied`, `expired`, and `invalidated` are terminal states. Lock,
revoke, lost-device state, process restart, expiry, conflicting target, or an
invalid authenticated request clears pending capability and unsealed handoff
material.

During the 30-second identical-retry window, the Mac retains only the sealed
response and the minimum authentication/retry metadata. It does not retain the
plaintext snapshot, private ephemeral key, ECDH secret, or derived handoff key.
When the window ends, all remaining pending material is invalidated.

Implementations perform best-effort cleanup of owned secret buffers on every
terminal path. This requirement does not claim provable zeroization of copies
created by the Swift runtime. Recovery never mints a new capability, extends
the invite TTL, changes the authenticated target, or permits downgrade.

## Separate Open Security Boundaries

- Local bridge authorization remains a separate open blocker: Pairing V2 does
  not resolve local bridge authorization or the bearer-contract mismatch.
- Restart-persistent replay rejection is Pairing V2 implementation work and is
  pending on `main`.
- The bounded Argon2 hostile-parameter checkpoint is resolved, but it does not
  clear Pairing V2, the bridge boundary, or the expanded review gate.
- The final remediated cross-platform implementation requires a new review of
  one exact merged `main` SHA.
- No independent third-party verdict exists for the expanded scope. Independent
  review and any paid/public-launch decision remain open.

## Implementation And Review Exit Criteria

Implementation commits are future work. The Pairing V2 gate can advance only
after all protocol requirements above are implemented, focused and repo-wide
verification is current, and the final packet records one exact merged
implementation SHA. A branch name, range, historical target, or "latest main"
cannot substitute for that immutable target.

External status remains `not dispatched` until the exact SHA is recorded and
the local remediation plus exact-target review evidence is attached. A request
document alone is not dispatch or review evidence.

## Design Gate

- UI impact: none
- Classification: no-ui-impact
- Design review: not applicable
- Pencil current read/mutation: not performed
- Pencil draft mutation: not performed
- Pencil sync: not applicable
- Pencil lease: not applicable
- Approval-frame authority: not restored
