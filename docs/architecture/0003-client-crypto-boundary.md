# Client Crypto Boundary

## Decision

Phase 1 treats encryption and unlock policy as client-facing product contracts, not just backend implementation details.

## Core Rules

- Vault contents are stored as encrypted envelopes.
- High-risk actions require the primary password, even if a device can unlock with biometrics.
- The server should coordinate sync and sessions, but it should not be modeled as a reader of plaintext vault contents.

## Phase-1 High-Risk Actions

- `vault_export`
- `revoke_device`
- `change_primary_password`

## Client Responsibilities

- Create and read vault envelopes locally
- Ask for the primary password before high-risk actions
- Surface clear trust copy about what the server can and cannot read

## Server Responsibilities

- Store encrypted payloads and supporting metadata
- Track device sessions and recent activity
- Enforce session validity and account-level policies

## Notes

- Bitwarden is the functional reference for these boundaries, but the product language should stay clear and Chinese-first.
- This document defines the minimum boundary needed before app implementation starts. It does not lock the final cryptographic algorithm list yet.
