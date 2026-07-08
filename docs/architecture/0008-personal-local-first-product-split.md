# Personal Local-First Product Split

## Decision

unuvault should be built as a personal full password manager with a
local-first, self-use-first product posture.

The full product can still grow into account-backed sync, browser extension
fill, iPhone access, family sharing, emergency access, and hosted operational
surfaces. The core architecture, however, must stay extractable as a lighter
local password box that does not require account login, cloud sync, or hosted
plaintext access.

This document is the product-split boundary for:

- `UnuVault Full`: the complete password manager product line
- `UnuVault Local`: a future local-only or lite packaging of the same core
- shared `core`: the security, vault, storage, unlock, and recovery substrate
  that both product lines rely on

## Why This Exists

The original phase-1 posture started from a public cloud password manager for
Chinese-speaking technical users. Later architecture moved the security model
toward local-first, account-optional, server-blind vault access. The product
direction now needs to make that evolution explicit.

The practical goal is simple: build the product fully enough that one owner can
trust it with real personal credentials, while preserving a clean path to ship a
local-only password box from the same foundation.

The risk to avoid is allowing cloud, account, or hosted sync assumptions to leak
into the vault core. Once that happens, a local version becomes a fork instead
of a packaging choice.

## Product Lines

### UnuVault Full

UnuVault Full is the complete password manager track.

It may include:

- Mac local vault and companion app
- browser extension fill and save
- Web vault management and trust-center surfaces
- iPhone vault viewing and pairing import
- account-backed encrypted sync
- device management and revocation
- activity review
- encrypted backup and restore
- later family sharing or emergency access

Full does not mean the server can read passwords. Hosted services coordinate
identity, encrypted payloads, device policy, and recovery metadata; vault unlock
still controls secret release.

### UnuVault Local

UnuVault Local is the extractable local password box.

It should support:

- local vault creation
- add, edit, delete, search, and reveal login items
- primary password unlock
- Touch ID or Face ID after the primary unlock policy is satisfied
- encrypted local storage
- local backup and encrypted restore
- browser fill through a native local bridge
- optional iPhone receive or view through explicit device pairing

It should not require:

- account registration
- hosted product bootstrap
- Supabase rows
- cloud sync
- remote activity review
- remote device revocation
- hosted recovery

Local is not a weaker security mode. It is the smallest complete product shape
where credentials remain useful without a network account.

## Architecture Layers

### Core

Core is shared by Full and Local.

Core owns:

- encrypted vault item schema
- vault key wrapping and unwrapping
- primary password policy
- local unlock policy
- high-risk action policy
- local encrypted vault storage contracts
- import and export formats
- backup and restore contracts
- device handoff payload contracts
- non-secret audit event schema
- origin-scoped credential release contracts

Core must not depend on:

- Supabase row shape
- `unuidentity`
- Web session state
- hosted product bootstrap
- account-enabled sync
- browser-extension runtime APIs
- SwiftUI, React, or server route implementations

If a module cannot run in a local-only product, it does not belong in Core.

### Local App

Local App is the device-local product shell around Core.

Local App owns:

- Mac companion UI and menu state
- macOS Keychain integration
- macOS LocalAuthentication integration
- local encrypted vault file placement
- loopback bridge process and local trust token
- browser-extension native bridge integration
- iOS pairing receive and local import
- iOS vault viewing for locally received material
- local-only backup and restore flows

Local App may call Core directly. It may expose local bridge endpoints, but only
with loopback binding, short-lived trust, vault unlock, and origin-scoped
release boundaries.

Local App must not require hosted account identity to unlock, reveal, fill,
export, restore, or pair a local vault.

### Cloud And Sync

Cloud and Sync are optional layers on top of Core and Local App.

Cloud and Sync own:

- `unuidentity` account integration
- `POST /auth/bootstrap`
- product profile creation
- encrypted vault sync routes
- device inventory
- device revocation coordination
- account-level activity
- account-assisted recovery coordination
- conflict handling
- hosted production readiness and observability surfaces
- future family sharing and emergency-access policy

Cloud and Sync may coordinate encrypted payloads and metadata, but they do not
own plaintext vault release.

## Non-Negotiable Boundaries

These rules protect the future local extraction:

- Encryption cannot depend on a server.
- Vault unlock cannot depend on account login.
- A vault item cannot be modeled as a Supabase row first.
- Mac local storage cannot depend on a Web session.
- Browser fill must be able to route through a native local app.
- iPhone receive must be able to import encrypted handoff material without a
  hosted plaintext reader.
- Account login can unlock account features, but it must not unlock passwords by
  itself.
- Recovery copy must not imply plaintext recovery when all local keys and
  recovery material are lost.

## Current Repo Mapping

Current modules map to the split this way:

- `packages/security/`: Core candidate. Keep crypto, unlock, trust-boundary, and
  secret-release policy free from account or hosted assumptions.
- `packages/domain/`: Core plus shared product contracts. Keep vault item and
  handoff schemas portable; keep account-only DTOs clearly named.
- `apps/macos/`: Local App. This is the first native local trusted root.
- `apps/ios/`: Local App plus future Cloud client. Pairing import and local view
  should remain usable before hosted sync is required.
- `apps/browser-extension/`: Local App client plus future Cloud client. Fill
  should prefer the native bridge boundary when local-first mode is active.
- `apps/web/`: Full product management and trust surface. It may request local
  release, but it must not become the plaintext vault owner.
- `apps/api/`: Cloud and Sync. Keep server routes server-blind and account
  scoped.
- `infra/supabase/`: Cloud and Sync persistence and migrations.
- `packages/api-client/`: Cloud client contracts. Do not make Core depend on
  this package.
- `packages/ui-copy/`: Product copy surface. Keep Local and Full promises
  distinct in user-facing text.

## Build Order

The safest implementation order is:

1. Make Mac local vault complete enough for real self-use:
   create, edit, delete, search, reveal, copy, lock, unlock, backup, restore.
2. Keep browser fill local-first:
   current origin, local bridge lookup, visible approval, one-time release.
3. Make iPhone useful without cloud dependency:
   receive paired material, import locally, view important login items.
4. Add optional encrypted sync:
   account identity, device list, encrypted payload sync, revoke coordination.
5. Add family and emergency features later:
   only after Core and Local App prove durable under real personal use.

## Packaging Rules

UnuVault Local should be possible to package by excluding Cloud and Sync.

That means:

- Core packages build without hosted env vars.
- Local App tests run without Supabase.
- browser fill has a native-local path that does not require Web login.
- iOS local receive/view has a non-account mode.
- docs, copy, and setup flows describe Local as a real mode, not as a broken
  offline state.

UnuVault Full can add account and sync features, but it should remain honest
that those features are additive.

## Verification Expectations

Local extraction readiness should be judged with local proof first:

- Mac local vault save/load without plaintext persistence
- primary password or local user-presence unlock boundary
- local bridge locked-state rejection
- one-origin, one-credential release after approval
- encrypted backup and restore
- iOS pairing import receipt on a physical device before claiming real-device
  transfer

Cloud readiness should be judged separately:

- bootstrap identity contract
- encrypted sync route behavior
- device revocation coordination
- account activity without secret leakage
- hosted production-readiness gates

Passing Cloud and Sync tests is not evidence that the Local product can stand
alone. Passing local proofs is not evidence that hosted sync is production
ready.

## Relationship To Existing Architecture

- `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
  remains historical product-scope context for the original phase-1 launch
  shape, but its `public cloud only` assumption is superseded by this
  product-split decision.
- `0006-local-first-recovery-boundary.md` owns local-first recovery and
  lost-device trust semantics.
- `0007-mac-companion-boundary.md` owns the Mac companion role and bridge
  boundary.
- This document owns the Full vs Local product split and the Core, Local App,
  Cloud and Sync layering rules.
