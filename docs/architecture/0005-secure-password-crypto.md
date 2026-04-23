# Secure Password Crypto

## Decision

Phase 1 upgrades the client-side password and dev-secret crypto boundary to a shared async sodium-backed substrate.

## Core Algorithms

- Password envelopes and developer secret blobs use `XChaCha20-Poly1305`
- Password derivation uses `Argon2id`
- Randomness comes only from the crypto library or `crypto.getRandomValues`
- Master password verification uses an `Argon2id`-based verifier string

## Compatibility Rules

- Read legacy plaintext, legacy envelope formats, and legacy verifier formats
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
- Independent review is still required before GA/public launch; phase-1
  beta/rehearsal currently relies on repo-owned evidence plus recorded internal
  preflight sign-off
- Observability and incident runbook work remain out of this slice by design
