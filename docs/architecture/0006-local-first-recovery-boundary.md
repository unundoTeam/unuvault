# Local-First Recovery Boundary

## Decision

unuvault is a local-first vault with an optional account-backed recovery and
sync layer.

Users should be able to create, unlock, and use a local vault on a trusted
device without treating account login as the source of password access. Account
identity is for cross-device sync, device revocation, activity review, and
recovery coordination. It must not imply that the server can read plaintext
vault contents.

Vault unlock remains mandatory for secret release. A local-only vault can avoid
account login, but it still needs a primary password, OS-backed local user
presence, or an equivalent unlock factor before credentials are revealed,
copied, exported, filled, or transferred.

## Product Posture

- Local-first: the device vault is the primary user-facing home for secrets.
- Account-optional: account login is not required for single-device local use.
- Unlock-required: local storage does not remove the need for vault unlock.
- Server-blind: sync and recovery services store or coordinate encrypted
  payloads, sessions, and metadata, not plaintext passwords.
- Device-approved: a new device should be trusted by an already-unlocked device,
  a recovery key, or an encrypted backup flow before it can receive vault
  material.

## Modes

### Local-only mode

Local-only mode is for users who want the strongest "my passwords stay on this
device" posture.

- Account login is not required.
- The local vault must be encrypted at rest.
- Secret release requires vault unlock.
- Browser or Web fill may call only a local bridge after an active unlock.
- There is no remote device revocation, remote activity review, or server-backed
  recovery.
- Losing every local copy and every recovery material means unuvault cannot
  restore plaintext vault contents.

### Account-enabled mode

Account-enabled mode adds sync and recovery controls without changing the
server-blind plaintext boundary.

- `unuidentity` plus the product bootstrap flow authenticate the person and
  establish the product identity.
- `/vault/sync` and related product routes may coordinate encrypted vault
  payloads for that identity.
- Device lists, recent activity, device revocation, and recovery prompts are
  available.
- Account login does not replace vault unlock.
- Account recovery must not promise plaintext recovery without the primary
  password, trusted device material, recovery key, or encrypted backup material.

## Device Loss Semantics

Device loss handling should be honest about what online controls can and cannot
do.

When a device is marked lost or revoked:

- the server should deny future sync, bootstrap-derived product sessions, and
  local bridge sessions for that device
- other trusted devices should stop trusting that device for pairing or vault
  material transfer
- the next online contact from the revoked device should force lockout,
  clear short-lived bridge sessions, and require re-approval before sync
- activity surfaces should show the revocation event without exposing secrets

Remote revocation cannot guarantee deletion of an already-downloaded encrypted
vault copy on a device that stays offline. The first line of defense for a lost
offline device is still local encryption, system disk protection, vault
auto-lock, and short-lived unlock sessions.

## High-Risk Actions

These flows must require the primary password or a fresh strong unlock, even if
the device supports biometrics:

- `vault_export`
- `revoke_device`
- `change_primary_password`
- approving a new device to receive vault material
- turning on cloud sync for an existing local-only vault
- generating or rotating recovery material

Biometrics can reduce daily friction after the first unlock, but they should not
silently authorize vault export, device transfer, or irreversible trust changes.

## Recovery Options

unuvault may offer these recovery paths:

- trusted-device recovery, where an already-unlocked device approves a new one
- recovery-key recovery, where user-held recovery material unwraps the vault key
- encrypted backup restore, where a backup is useful only with the required
  unlock or recovery material
- account-assisted recovery, where the account helps find devices, activity,
  backups, and encrypted payloads but does not decrypt secrets by itself

unuvault should not offer or imply:

- server-side plaintext recovery
- full vault restore after both primary password and recovery material are lost
- remote deletion guarantees for encrypted data already present on an offline
  lost device

## Local Bridge Rules

The local credential bridge remains a constrained secret-release surface:

- bind the bridge to loopback only
- require a short-lived bridge token or equivalent local trust proof
- release credentials only after vault unlock
- return metadata before release and only one credential payload for the active
  origin after explicit fill intent
- record non-secret audit events for release attempts
- clear bridge sessions on lock, timeout, revoke, or lost-device state

The Web surface may request credentials from a local client, but it must not be
modeled as owning the whole vault or receiving bulk plaintext.

## User-Facing Promise

The product should consistently communicate this promise:

> You can use your vault locally without an account. Signing in adds sync,
> recovery, and device controls. Your vault still requires local unlock, and the
> server is not a plaintext reader of your passwords.

## Relationship To Existing Architecture

- `0003-client-crypto-boundary.md` owns the core encrypted-envelope and
  high-risk primary-password rule.
- `0005-secure-password-crypto.md` owns the concrete secure crypto substrate and
  compatibility rules.
- This document owns the product-level local-first, account-optional, lost-device,
  and recovery trust semantics.
