# Mac Companion Local User Presence Design

**Problem:** the Mac companion now has proof for encrypted local vault storage,
short-lived unlock sessions, recovery boundaries, and one-time native approval,
but the real unlock path still opens the local vault without a code-level
`LocalAuthentication` user-presence boundary. The architecture allows Touch ID
or another macOS local user-presence factor after the primary unlock policy is
satisfied; the repo needs a narrow implementation slice that proves this
boundary without making broad UI, notarization, or physical-device claims.

## Current State

- [`docs/architecture/0007-mac-companion-boundary.md`](../../../docs/architecture/0007-mac-companion-boundary.md)
  says the Mac companion owns local unlock and should allow Touch ID or another
  macOS local user-presence factor after primary-password policy is satisfied.
- [`docs/architecture/0006-local-first-recovery-boundary.md`](../../../docs/architecture/0006-local-first-recovery-boundary.md)
  says vault unlock is mandatory before credentials are revealed, filled,
  copied, exported, or transferred.
- [`scripts/testing/run-mac-security-preflight.sh`](../../../scripts/testing/run-mac-security-preflight.sh)
  proves the local Mac can link `LocalAuthentication`, but it intentionally does
  not prompt Touch ID or unlock the vault.
- [`scripts/testing/run-mac-local-vault-receipt.sh`](../../../scripts/testing/run-mac-local-vault-receipt.sh)
  proves the local encrypted vault and release boundaries, but it still marks
  Touch ID and physical iPhone proof as unclaimed.
- [`apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`](../../../apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift)
  currently calls `vaultStore.loadCredentials()` before opening a session, with
  no injected local user-presence authorizer.

## Approaches

### Option 1: Prompt Touch ID directly inside `CompanionViewModel`

This is direct, but it makes the view model hard to test and would couple UI
state, vault IO, and OS authentication in one place.

### Option 2: Add a small injectable local user-presence authorizer (Recommended)

Introduce a narrow `LocalUserPresenceAuthorizer` abstraction. Production uses
`LocalAuthentication.LAContext`; tests and proof mode inject deterministic
allow/deny authorizers. The view model asks the authorizer before reading the
vault and before opening a local unlock session.

This is recommended because it proves the security boundary in code while
keeping CI and smoke proof stable. It also leaves room to add richer Touch ID
copy or screenshots later without changing the secret-release model again.

### Option 3: Build full Touch ID UX automation now

This would try to capture the system prompt or drive a real user-presence
interaction through macOS UI automation. It is too broad for this slice and
likely to be flaky across machines.

## Chosen Design

Use option 2.

Add a Mac companion local user-presence boundary with three parts:

1. A protocol, for example `LocalUserPresenceAuthorizer`, with an async method
   that returns success or a specific denial/unavailable result.
2. A production implementation backed by `LocalAuthentication.LAContext`.
3. Test/proof implementations that allow deterministic success, denial, and
   unavailable states without opening a system prompt.

`CompanionViewModel.unlockLocalVault()` should call the authorizer before
loading credentials from `LocalCompanionVaultStore`. If authorization fails, the
view model must not read credentials, must not call `session.unlock`, and must
show a local-auth failure decision message.

## Authorization Semantics

The first implementation should use a daily-unlock policy, not a high-risk
action policy.

- Allowed:
  - unlock the local vault session after the encrypted vault already exists on
    this Mac
  - use Touch ID or device-owner authentication as friction reduction
  - skip the real OS prompt only in explicit proof/test injection paths
- Not allowed:
  - authorize vault export
  - authorize device pairing material transfer
  - authorize recovery material generation or rotation
  - replace future primary-password or fresh-strong-unlock requirements for
    high-risk actions

The prompt reason should be explicit and local, such as:

```text
Unlock UnuVault local vault on this Mac
```

The implementation may use `.deviceOwnerAuthentication` instead of biometrics
only, so a Mac without enrolled Touch ID can still use the system-backed owner
authentication path. The docs and tests should call this `LocalAuthentication`
or local user presence unless a real Touch ID-specific manual proof exists.

## Data Flow

The normal unlock path should become:

1. User clicks `Unlock vault`.
2. View model asks the authorizer for fresh local user presence.
3. If local user presence succeeds, the view model loads encrypted vault
   credentials from the local store.
4. If credentials exist, the view model opens a short-lived
   `CompanionVaultSession`.
5. If local user presence fails, the view model keeps the session locked and
   leaves the local vault unread.

Proof mode should inject an allow authorizer so existing menu-app smoke tests
do not hang on a system prompt. A denial test should inject a deny authorizer
and prove the vault store is not read.

## Error Handling

Map authorization outcomes into small user-facing states:

- authorized: continue with vault loading
- denied or canceled: keep locked and show local authorization failed
- unavailable: keep locked and show local authorization unavailable

No failure state should expose credential metadata or plaintext.

## Verification Strategy

Add tests before implementation:

- View-model test: an allow authorizer permits local vault load and opens the
  session.
- View-model test: a deny authorizer prevents vault load and keeps the session
  locked.
- View-model test: an unavailable authorizer keeps the session locked and shows
  the unavailable decision text.
- Source/entrypoint test: the local-auth proof is registered in README and
  evidence docs only as code-boundary proof, not as Touch ID UX proof.

Expected command shape:

```bash
swift test --package-path apps/macos/App --filter LocalUserPresence
pnpm test:macos:security-preflight
pnpm test:macos:local-vault-receipt
pnpm test
pnpm lint
```

## Out Of Scope

- Full Touch ID prompt screenshot proof
- macOS notarization
- login-item persistence behavior
- primary-password setup or password-derived local vault keys
- Web UI changes
- Pencil current/draft changes
- iOS pairing or physical iPhone receipt
- high-risk action authorization for export, recovery, or device transfer

## Acceptance Criteria

- `CompanionViewModel` cannot unlock the local session unless local user
  presence succeeds.
- A denied or unavailable local user-presence result prevents vault reads and
  keeps the session locked.
- Proof and smoke modes can inject a deterministic allow authorizer.
- README and Mac companion evidence docs state the new proof boundary without
  claiming full Touch ID UX evidence.
- Existing Mac local vault receipt and security preflight still pass.
