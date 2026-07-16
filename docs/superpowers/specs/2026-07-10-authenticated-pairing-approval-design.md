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

The following byte definitions are normative. `ASCII(s)` is the exact ASCII
byte sequence for `s`; `NFC-UTF8(s)` is the UTF-8 encoding of Unicode text
after NFC normalization; `u16be`, `u32be`, and `u64be` are fixed-width unsigned
big-endian integers; `||` is byte concatenation. The length-prefix primitive
is:

```text
LP(bytes) = u32be(byteLength) || bytes
```

Every component shown in a transcript below is wrapped in exactly one `LP`,
including fixed-width integers, fixed-size nonces, hashes, authenticators, and
domain strings. The bytes inside `LP(...)` are raw bytes; an implementation
must not put a base64url string, JSON spelling, field name, separator, or a
second length prefix inside the component unless the definition explicitly
says so. Fields must never be sorted, omitted, duplicated, or accepted through
an alternate spelling.

The protocol constants are:

```text
PAIRING_VERSION = u16be(2)
CLAIM_DOMAIN = ASCII("unuvault-pairing-claim-v2")
P256_SPKI_DER = canonical DER SubjectPublicKeyInfo for one P-256 public key
```

`P256_SPKI_DER` is one DER `SubjectPublicKeyInfo` container. Its
`AlgorithmIdentifier` is exactly `id-ecPublicKey` (`1.2.840.10045.2.1`) with
the named-curve parameter `prime256v1` (`1.2.840.10045.3.1.7`). Its subject
public-key BIT STRING has zero unused bits and contains exactly the 65-byte
ANSI X9.63 uncompressed point `0x04 || X || Y`, where `X` and `Y` are each
32-byte unsigned big-endian coordinates. The point must be on P-256, must not
be the point at infinity, and must use minimal definite-length DER with no
trailing bytes. Parse-and-reserialize must reproduce the input byte-for-byte.
Both `canonicalTargetIdentityDER` and `canonicalEphemeralPublicKeyDER` below
use this same container and no other public-key representation.

Binary values cross JSON or QR boundaries only as strict unpadded base64url.
A decoder rejects padding, non-URL alphabet characters, non-minimal encodings,
the wrong decoded length, or any value whose decode-and-re-encode result is not
byte-identical to the input. `clientNonce` is exactly 32 cryptographically
random bytes. The textual `inviteSessionId`, `targetDeviceId`, and
`targetDisplayName` fields use `NFC-UTF8`; the fixed-size `claimId` and
`handoffId` defined below are raw bytes and never use NFC or another string
encoding inside a transcript. Expiry is
`u64be(expiresAtEpochMilliseconds)` and must be a non-negative integer with no
fractional or alternate textual form before conversion to bytes.

`canonicalMacBaseURL` is produced by this single algorithm:

1. Accept at most 512 ASCII bytes and parse them as one absolute URI. Reject
   any percent-encoded octet, non-ASCII input, or alternate parser repair.
2. Require the scheme to be the lowercase ASCII string `http` or `https`.
3. Reject user info. Require one explicit decimal port in `1...65535`, with no
   sign or leading zero.
4. Require the host to be one of exactly these three ASCII encodings: canonical dotted-decimal IPv4, bracketed RFC 5952 IPv6, or a canonical DNS A-label host.
   - IPv4 has four shortest-decimal octets in `0...255`, separated by `.`, with
     no sign and no leading zero except the single digit `0`.
   - Unscoped IPv6 is enclosed in `[` and `]`; the address text inside is the
     unique lowercase RFC 5952 serialization, including its longest-leftmost
     zero-run compression rule. IPv4-embedded IPv6 addresses always use the eight 16-bit hexadecimal fields as input to the same RFC 5952 algorithm;
     mixed dotted-decimal notation is not accepted. This protocol choice
     resolves RFC 5952 Section 5's context-dependent mixed-notation option to
     one serialization.
   - A DNS host contains lowercase canonical IDNA2008 A-labels separated by
     `.`, with no trailing dot. Each label is 1...63 ASCII bytes, the total is
     at most 253 bytes, and each label must pass an IDNA2008
     decode-and-ToASCII round trip byte-for-byte. Raw Unicode and transitional
     UTS #46 mappings are not alternate inputs.
   Zone identifiers are not part of this URL encoding: `%`, `%25`, interface
   names, and numeric zone spellings are rejected rather than normalized.
   Scoped IPv6 endpoints require a separate endpoint-selection rule before
   they can be represented; this does not declare unscoped IPv6 unsupported.
5. Require an empty path and reject query and fragment components. A trailing
   slash is therefore not an alternate accepted spelling.
6. Serialize exactly `scheme || ASCII("://") || host || ASCII(":") ||
   shortestDecimal(port)`. The input must already equal this serialization
   byte-for-byte; there is no second accepted URL spelling.

URL canonicalization is only a bounded authenticated encoding. Endpoint reachability, address-family support, and private-versus-public address admission are separate implementation/security policy; this specification neither approves nor rejects an endpoint because of its address class. No allowed host, source IP, URL, or LAN reachability is an authenticator.

The canonical claim transcript is the concatenation of these fields in order:

1. `LP(CLAIM_DOMAIN)`
2. `LP(NFC-UTF8(inviteSessionId))`
3. `LP(u64be(expiresAtEpochMilliseconds))`
4. `LP(ASCII(canonicalMacBaseURL))`
5. `LP(canonicalTargetIdentityDER)`
6. `LP(NFC-UTF8(targetDeviceId))`
7. `LP(NFC-UTF8(targetDisplayName))`
8. `LP(clientNonce)`

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
one 256-bit key. The ECDH input keying material is the raw 32-byte unsigned
big-endian P-256 shared-point X coordinate; it is not a DER object, encoded
point, or base64url text.

The KDF and AAD constants are:

```text
ALGORITHM_ID = ASCII("P256-HKDF-SHA256-AES-GCM-256-V2")
HKDF_SALT_DOMAIN = ASCII("unuvault-pairing-hkdf-salt-v2")
HKDF_INFO_DOMAIN = ASCII("unuvault-pairing-handoff-key-v2")
HANDOFF_AAD_DOMAIN = ASCII("unuvault-pairing-handoff-aad-v2")
CLAIM_ID_BYTES = 32
HANDOFF_ID_BYTES = 32
AES_GCM_NONCE_BYTES = 12
```

The Mac generates both identifiers with a cryptographically secure random number generator. `claimId` is allocated inside the durable reservation transaction after target-claim authentication; `handoffId` is allocated inside the later atomic transition to `sealing` after fresh owner authorization and all rechecks pass. Each identifier is 32 uniformly random raw bytes, giving 256 bits of generation entropy, and its only JSON/wire spelling is strict unpadded base64url of exactly 32 raw bytes. The raw bytes, not the base64url spelling or NFC text, enter HKDF and AAD.

Both identifier kinds share one Mac-installation-wide Pairing V2 uniqueness
namespace. Before committing either transaction, the Mac checks the candidate
against both identifier fields in every live, terminal, or retained tombstone
record. A collision with any live, terminal, or retained tombstone record
discards the candidate and draws a new 32-byte value, for at most 8 independent draws per identifier. If all 8 collide, the transaction fails with the generic internal
failure, creates no reservation or handoff, and never reuses the colliding
value. Randomness is the security basis; the collision check makes local
uniqueness and recovery behavior deterministic.

The exact HKDF-SHA256 salt is:

```text
LP(HKDF_SALT_DOMAIN) ||
LP(pairingSecret)
```

`pairingSecret` is the raw 32-byte QR secret, not its base64url spelling. The
exact HKDF-SHA256 `info` is the following ordered concatenation:

```text
LP(HKDF_INFO_DOMAIN) ||
LP(ALGORITHM_ID) ||
LP(PAIRING_VERSION) ||
LP(NFC-UTF8(inviteSessionId)) ||
LP(claimId) ||
LP(handoffId) ||
LP(u64be(expiresAtEpochMilliseconds)) ||
LP(canonicalTargetIdentityDER) ||
LP(canonicalEphemeralPublicKeyDER) ||
LP(clientNonce)
```

HKDF expands exactly 32 output bytes and does not apply an additional label,
separator, hash, string encoding, or length prefix beyond the salt and `info`
above.

AES-GCM seals one versioned vault snapshot. Its canonical AAD binds the exact
algorithm identifier, protocol version, invite session, claim, handoff,
authenticated target identity, expiry, and ephemeral public key in a fixed
domain and field order. The exact AAD is:

```text
LP(HANDOFF_AAD_DOMAIN) ||
LP(ALGORITHM_ID) ||
LP(PAIRING_VERSION) ||
LP(NFC-UTF8(inviteSessionId)) ||
LP(claimId) ||
LP(handoffId) ||
LP(canonicalTargetIdentityDER) ||
LP(u64be(expiresAtEpochMilliseconds)) ||
LP(canonicalEphemeralPublicKeyDER)
```

The Mac generates a fresh uniformly random 12-byte AES-GCM nonce for the one
sealed handoff. The raw 12 bytes are passed to AES-GCM; the response field is
their strict unpadded base64url spelling. `sealedCiphertext` is strict unpadded
base64url of `ciphertext || tag`, with the 16-byte GCM authentication tag last.
The nonce is not prepended to `sealedCiphertext`, not derived from an
identifier, and never reused with the derived key.

The public response contains only the version, algorithm, identifiers, expiry,
canonical ephemeral public key, AES-GCM nonce, ciphertext, and fields required
to reconstruct the KDF context and AAD. It contains no `pairingSecret`, private
key, ECDH secret, derived key, capability, vault plaintext, credential
plaintext, or password.

## Single Use And Persistent Replay Rejection

The retry-identity domain is:

```text
RETRY_IDENTITY_DOMAIN = ASCII("unuvault-pairing-retry-identity-v2")
```

After successful target-claim authentication, the exact retry identity is:

```text
LP(RETRY_IDENTITY_DOMAIN) ||
LP(canonicalClaimTranscript) ||
LP(claimAuthenticator)
```

`canonicalClaimTranscript` is the complete byte string defined above and
`claimAuthenticator` is the raw 32-byte HMAC-SHA256 output, not either value's
base64url or JSON spelling. These bytes are the full authenticated retry
identity: every request value used for target authentication, owner approval,
key derivation, AAD, or response selection is either present in the canonical
claim transcript or derived from it. The durable record retains the exact
retry-identity bytes in encrypted storage and compares the transcript and
authenticator byte-for-byte; a digest alone cannot substitute for the full
identity.

The reservation state machine is normative. Its success path is
`unreserved` -> `authorizing` -> `sealing` -> `ready` -> `consumed`;
`denied`, `expired`, and `invalidated` are alternate terminal states from
`authorizing` or `sealing`:

1. The Mac verifies the HMAC and canonical request first. An unauthenticated
   request receives only the generic authentication failure and cannot learn
   whether a reservation exists.
2. For the first valid request, one encrypted-store transaction rechecks the
   unreserved and unexpired invitation, allocates `claimId`, persists the exact
   retry identity and original authenticated `clientNonce`, consumes the
   invitation, and atomically creates the durable reservation before fresh owner authorization by entering `authorizing`. No retry window starts here.
3. Exactly one worker for that reservation creates the fresh `LAContext`. A
   byte-identical authenticated request received in `authorizing` or `sealing`
   does not start another authorization, snapshot read, or seal; it receives
   `handoff_response_not_ready` with no handoff payload, identifiers, or timing
   metadata. A different authenticated retry identity receives terminal
   `handoff_consumed`. An invalid authenticator still receives the generic
   authentication failure.
4. After owner authorization succeeds, one atomic transaction rechecks the
   reservation identity, vault session identity, authenticated target, expiry,
   lock state, revoked or lost-device state, and pending capability. It then
   allocates `handoffId` and changes `authorizing` to `sealing`. A failed recheck
   makes the record terminal without a snapshot read.
5. The reserved worker performs exactly one in-memory snapshot read after the `sealing` transition, creates one ephemeral key, derives one handoff key, and
   seals once. No retry path can repeat any of those operations.
6. Before publishing a response, one transaction rechecks expiry and the same
   reservation, persists the exact serialized sealed response plus `readyAt`,
   and changes `sealing` to `ready`. A read, derivation, sealing, persistence,
   recheck, or process failure instead atomically records a terminal state and
   publishes no handoff. A recovered `authorizing` or `sealing` record is
   changed to `invalidated`; it is never resumed from volatile material.

The ready retry window starts only when the durable record atomically enters `ready`, never at reservation or owner-authorization time. Its immutable deadline is the minimum of `readyAt + 30 seconds` and the original invitation expiry. During that window, only a request whose
canonical claim transcript and authenticator
are each byte-identical to the reservation, including the original authenticated `clientNonce`, receives the retained serialized response. The sealed response, including its AES-GCM nonce, is reused byte-for-byte; it is not reserialized or resealed, and retry does not move `readyAt` or extend the deadline. A different authenticated request receives terminal `handoff_consumed`. Before the deadline, an encrypted durable `ready` record and its response survive Mac process restart. At the deadline, one atomic transition removes the sealed response, records `consumed`, and retains the identifiers and consumed tombstone needed for persistent replay rejection.

iOS verifies and imports in one encrypted-store transaction. If either `claimId` or `handoffId` already exists in the consumed-ID store, iOS rejects
the entire response as replay even when the other identifier is new. Otherwise
the same transaction writes the credentials, `claimId`, and `handoffId`; no
partial import or overwrite is permitted. Consumed IDs survive app and process
restart and remain for the lifetime of the received-vault store unless an
explicit secure reset deletes both the vault and replay store together. An
in-memory replay set is insufficient.

No V2 failure state permits a V1 whole-vault downgrade. A V2 client fails
closed after authentication failure, `handoff_response_not_ready`, denial,
expiry, invalidation, consumed response, persistence failure, or replay. Once
V2 is the production requirement, the Mac must not return whole-vault material
for a V1 claim.

## Terminal Cleanup And Bounded Recovery

`consumed`, `denied`, `expired`, and `invalidated` are terminal states. A lock,
revoke, lost-device state, process restart while `authorizing` or `sealing`,
expiry, or failure owned by the reserved workflow atomically enters the
applicable terminal state and clears pending capability and unsealed handoff
material. An unauthenticated or different authenticated request does not mutate the reserved workflow; it receives the response defined by the state machine above.

During the ready identical-retry window, the Mac retains only the encrypted
sealed response, exact retry-identity bytes, identifiers, immutable timestamps,
state, and minimum authentication metadata. It does not retain the plaintext
snapshot, private ephemeral key, ECDH secret, or derived handoff key. When the
window ends, the sealed response is removed while the durable consumed
tombstone remains.

Implementations perform best-effort cleanup of owned secret buffers on every
terminal path. This requirement does not claim provable zeroization of copies
created by the Swift runtime. Recovery never mints a new capability, extends
the invite TTL, changes the authenticated target, or permits downgrade.

A deployment rollback disables new whole-vault transfer and preserves every durable reservation and consumed-ID tombstone until a security-compatible forward migration can read them. If the older build cannot read the V2 state, it fails closed instead of deleting replay history or re-enabling V1 whole-vault transfer.

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
