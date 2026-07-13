# Secure Password Crypto

## Decision

Phase 1 upgrades the client-side password and dev-secret crypto boundary to a shared async sodium-backed substrate.

## Core Algorithms

- Password envelopes and developer secret blobs use `XChaCha20-Poly1305`
- Password derivation uses `Argon2id`
- Randomness comes only from the crypto library or `crypto.getRandomValues`
- Master password verification uses an `Argon2id`-based verifier string

## Bounded Argon2 Policy

- The implemented policy for current password-derived envelopes pins
  libsodium's interactive Argon2id13 tuple to `opsLimit = 2` and
  `memLimit = 67_108_864` bytes. Current PHC verifiers pin
  `$argon2id$v=19$m=65536,t=2,p=1`.
- Salt and XChaCha20 nonce fields are canonical unpadded Base64URL encoding of
  exactly `16` and `24` bytes. The authenticated ciphertext is bounded from the
  `16`-byte AEAD tag through `1_048_592` bytes, corresponding to at most
  `1_048_576` plaintext bytes. Purpose tags accepted for password-derived
  envelope reads are non-empty and at most `128` UTF-8 bytes.
- PHC verifier strings are printable ASCII, use canonical unpadded Base64 for
  the fixed `16`-byte salt and `32`-byte hash fields, and are at most `127`
  characters. Web and extension serialized verifier storage is rejected above
  `512` characters.
- Vault and developer-secret envelope JSON is rejected above `1_400_171`
  characters, before `JSON.parse`. This bound applies to legacy and current
  envelopes; there is no unbounded runtime fallback.
- Incoming current envelopes and verifiers are checked against these bounds,
  the exact tuple, and the loaded sodium runtime before
  `crypto_pwhash`/`crypto_pwhash_str_verify`. Unsupported input fails closed
  without starting the password KDF. New writes also fail if the runtime drifts
  from the pinned policy.

## Compatibility Rules

- Continue reading vault `v1` plaintext and XOR `v2`, developer-secret XOR
  `v1`, and master-password verifier `v1` through their explicit compatibility
  readers, subject to the bounded serialized-input guards above
- Write only the newest secure versions
- Rewrite legacy verifier material to `v2` after a successful unlock or setup
- Rewrite legacy password and dev-secret material to the newest version after save, edit, import, or rewrap

## Public Surface

- `VaultEnvelope` is a union of legacy plaintext, XOR `v2`, and secure `v3`
- `DeveloperSecretEnvelope` is a union of `v1` and `v2`
- `MasterPasswordVerifier` is a union of `v1` and `v2`
- Security helpers are async so the browser, extension, and CLI can share the same boundary

## Residual Risks

- Legacy compatibility keeps older payloads readable, so migration pressure still depends on user activity
- Current-scope crypto launch approval uses the repo-backed internal iterative review gate in
  `docs/operations/crypto-review-gate.md`
- Third-party crypto review is deferred by
  `docs/operations/crypto-review-launch-exception.md`; reopen it under that
  policy before large-scale public risk, paid or compliance claims, material
  crypto-boundary changes, or crypto incidents
- The bounded Argon2 checkpoint does not complete or approve Pairing V2. Its
  authenticated claim, owner-approval, bridge-authorization, and persistent
  replay work remains outside this checkpoint
- Public copy must not describe this crypto boundary as independently reviewed
  or third-party reviewed
- Observability and incident runbook work remain out of this slice by design
