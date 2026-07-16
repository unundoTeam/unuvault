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
random bytes. Identifiers and display text use `NFC-UTF8`; expiry is
`u64be(expiresAtEpochMilliseconds)` and must be a non-negative integer with no
fractional or alternate textual form before conversion to bytes.

`canonicalMacBaseURL` is produced by this single algorithm:

1. Accept at most 255 ASCII bytes and parse them as one absolute URI. Reject
   any percent-encoded octet.
2. Require the scheme to be the lowercase ASCII string `http` or `https`.
3. Reject user info. Require one explicit decimal port in `1...65535`, with no
   sign or leading zero.
4. Require the host to be either (a) canonical dotted-decimal IPv4 with four
   decimal octets and no leading zero, limited to RFC 1918 private or
   `169.254.0.0/16` link-local space, or (b) a lowercase ASCII `.local` DNS
   name whose labels are 1...63 bytes, whose total host length is at most 253
   bytes, and whose labels contain only `a-z`, `0-9`, or an interior hyphen.
   Reject `localhost`, a trailing dot, Unicode/IDNA input, IPv6, unspecified,
   loopback, multicast, and public addresses in this V2 encoding.
5. Require an empty path and reject query and fragment components. A trailing
   slash is therefore not an alternate accepted spelling.
6. Serialize exactly `scheme || ASCII("://") || host || ASCII(":") ||
   shortestDecimal(port)`. The input must already equal this serialization
   byte-for-byte; there is no second accepted URL spelling.

URL canonicalization bounds the transcript representation; it does not make
the host, source IP, or LAN reachability an authenticator.

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
AES_GCM_NONCE_BYTES = 12
```

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
LP(NFC-UTF8(claimId)) ||
LP(NFC-UTF8(handoffId)) ||
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
LP(NFC-UTF8(claimId)) ||
LP(NFC-UTF8(handoffId)) ||
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
base64url or JSON spelling. Successful consume uses one atomic reservation
bound to those exact retry-identity bytes, the original authenticated `clientNonce`
contained in the transcript, the original reservation time, and the exact
serialized sealed-response bytes.

A retry is eligible only if its canonical claim transcript and authenticator
are each byte-identical to the reservation, including the original
authenticated `clientNonce`. Within at most 30 seconds measured from the
original reservation, the retained sealed response, including its AES-GCM nonce, is reused byte-for-byte;
the response is not reserialized or resealed,
and a retry never extends the deadline. After reservation, a different
`clientNonce` or any changed authenticated field produces a different retry
identity and receives terminal `handoff_consumed`; it cannot replace the
reservation. An invalid authenticator still receives only the generic
authentication failure and does not disclose reservation state.

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
