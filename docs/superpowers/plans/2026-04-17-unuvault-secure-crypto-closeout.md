# Unuvault Secure Crypto Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current secure-crypto worktree into a merge-ready change by re-verifying the sodium-based boundary, the Web and extension call chains, and the audit handoff docs without reopening scope.

**Architecture:** The current diff already introduces the async sodium layer, versioned security helpers, and runtime-specific tests. This plan treats the slice as implementation-mostly-done and focuses on closeout: prove the helper contracts still hold, prove the UI and CLI call chains still behave under async crypto, then align the handoff and launch docs with the final verified diff.

**Tech Stack:** pnpm workspace, TypeScript, Vitest, React, Next.js, browser extension runtime, `libsodium-wrappers-sumo`, repo shell runners

---

## File Structure Map

- `packages/security/package.json`
  - workspace dependency surface for the sodium-backed helper layer
- `packages/security/src/sodium.ts`
  - shared async sodium loader, password hashing, and envelope seal/open primitives
- `packages/security/src/vault-envelope.ts`
  - vault password envelope versioning, legacy reads, and latest-write path
- `packages/security/src/master-password-verifier.ts`
  - master-password verification and upgrade-aware rewrite behavior
- `packages/security/src/developer-secret-envelope.ts`
  - developer secret codec using the same secure crypto substrate
- `packages/security/tests/*.spec.ts`
  - focused security regression coverage for secure versions, legacy reads, and fail-closed behavior
- `apps/web/src/components/vault/*.ts*`
  - async unlock, reveal, sync, and storage flows for the Web vault
- `apps/web/tests/*.spec.ts*`
  - Web regression coverage for sodium runtime, unlock, upgrade, and reveal flows
- `apps/browser-extension/src/background/*.ts`
  - extension unlock runtime and unlocked-vault reader behavior
- `apps/browser-extension/src/popup/*.ts*`
  - popup async unlock, search, and reveal behavior
- `apps/browser-extension/tests/*.spec.ts*`
  - extension runtime and popup regression coverage
- `scripts/secrets/provider.ts`
  - CLI/dev-secrets provider path under the new async crypto helpers
- `tests/dev-secrets-provider.spec.ts`
  - CLI regression coverage
- `docs/architecture/0005-secure-password-crypto.md`
  - ADR for the secure crypto boundary and compatibility posture
- `docs/operations/crypto-review-gate.md`
  - internal release gate for this crypto slice
- `docs/operations/secure-crypto-pr-audit-handoff.md`
  - PR and audit handoff summary, command list, and residual risks
- `docs/launch/phase1-launch-checklist.md`
  - launch checklist hook for the internal-complete vs external-audit distinction

## Task 1: Lock The Security Helper Contracts

**Files:**
- Modify: `packages/security/package.json`
- Modify: `packages/security/src/sodium.ts`
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/src/master-password-verifier.ts`
- Modify: `packages/security/src/developer-secret-envelope.ts`
- Modify: `packages/security/tests/sodium.spec.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`
- Modify: `packages/security/tests/master-password-verifier.spec.ts`
- Modify: `packages/security/tests/developer-secret-envelope.spec.ts`

- [ ] **Step 1: Refresh the failing security assertions first**

```ts
it("writes vault envelopes only in the secure version", async () => {
  const sealed = await sealVaultPassword("hunter2", "correct horse");
  expect(JSON.parse(sealed)).toMatchObject({
    version: 3,
    cipher: "xchacha20poly1305-ietf",
    keyDerivation: "argon2id13",
  });
});

it("upgrades a legacy verifier after successful verification", async () => {
  const legacy = createLegacyMasterPasswordVerifier("correct horse");
  const result = await verifyMasterPassword(legacy, "correct horse");
  expect(result.ok).toBe(true);
  expect(result.upgradedVerifier?.version).toBe(2);
});
```

- [ ] **Step 2: Run the focused package-security suite and confirm the current breakage**

Run: `./node_modules/.bin/vitest --run packages/security/tests/sodium.spec.ts packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts`

Expected: any failure should point to version shape, legacy-compat behavior, or fail-closed handling inside `packages/security`

- [ ] **Step 3: Keep the implementation boundary narrow while fixing failures**

```ts
export type VerifyMasterPasswordResult =
  | { ok: false; upgradedVerifier: null }
  | { ok: true; upgradedVerifier: MasterPasswordVerifierV2 | null };

export async function openStoredVaultPassword(ciphertext: string, passphrase?: string) {
  if (!ciphertext) return "";
  if (looksLikeLegacyPlaintext(ciphertext)) return ciphertext;
  return openVaultPassword(ciphertext, passphrase);
}
```

- [ ] **Step 4: Re-run the same focused suite until it is green**

Run: `./node_modules/.bin/vitest --run packages/security/tests/sodium.spec.ts packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts`

Expected: PASS, proving the sodium substrate and the three helper families now agree on secure writes, legacy reads, and fail-closed behavior

- [ ] **Step 5: Commit the helper-contract slice**

```bash
git add packages/security/package.json packages/security/src/sodium.ts packages/security/src/vault-envelope.ts packages/security/src/master-password-verifier.ts packages/security/src/developer-secret-envelope.ts packages/security/tests/sodium.spec.ts packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts
git commit -m "feat: harden secure crypto helpers"
```

## Task 2: Lock The Web, Extension, And CLI Call Chains

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/master-password-storage.ts`
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/use-vault-unlock.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/security-sodium-runtime.spec.ts`
- Modify: `apps/web/tests/master-password-storage.spec.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`
- Modify: `apps/browser-extension/scripts/build.mjs`
- Modify: `apps/browser-extension/src/background/unlock-session.ts`
- Modify: `apps/browser-extension/src/background/unlocked-vault.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/src/popup/login-payload.ts`
- Modify: `apps/browser-extension/src/popup/master-password-storage.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/tests/security-sodium-runtime.spec.ts`
- Modify: `apps/browser-extension/tests/background-unlock.spec.ts`
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
- Modify: `apps/browser-extension/tests/master-password-storage.spec.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`
- Modify: `apps/browser-extension/tests/packaging-build.spec.ts`
- Modify: `scripts/secrets/provider.ts`
- Modify: `tests/dev-secrets-provider.spec.ts`

- [ ] **Step 1: Refresh the user-facing regression tests before editing runtime code**

```ts
it("upgrades the stored verifier after a successful unlock", async () => {
  render(<VaultPanel />);
  await user.type(screen.getByLabelText(/master password/i), "correct horse");
  await user.click(screen.getByRole("button", { name: /unlock vault/i }));
  await waitFor(() => expect(readStoredVerifierVersion()).toBe(2));
});

it("reveals passwords only after an async user action", async () => {
  await user.click(screen.getByRole("button", { name: /show password/i }));
  expect(await screen.findByDisplayValue("hunter2")).toBeVisible();
});
```

- [ ] **Step 2: Keep decrypt paths event-driven and async**

```ts
const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

async function revealPassword(item: VaultSyncItem) {
  const password = await readDraftPassword(
    item.encrypted_payload,
    unlockPassphrase ?? undefined,
  );
  setRevealedPasswords((current) => ({ ...current, [item.id]: password }));
}
```

- [ ] **Step 3: Run the focused runtime matrix for Web, extension, and CLI**

Run: `./node_modules/.bin/vitest --run apps/web/tests/security-sodium-runtime.spec.ts apps/web/tests/master-password-storage.spec.ts apps/web/tests/vault-page.spec.tsx apps/browser-extension/tests/security-sodium-runtime.spec.ts apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/packaging-build.spec.ts tests/dev-secrets-provider.spec.ts`

Expected: PASS, proving the async crypto helpers work in Next.js, the browser extension runtime, popup flows, and the CLI provider

- [ ] **Step 4: Run repo-standard gates after the focused matrix is green**

Run: `bash scripts/testing/lint-runner.sh`

Expected: PASS

Run: `bash scripts/testing/test-runner.sh`

Expected: PASS

- [ ] **Step 5: Commit the call-chain closeout slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/master-password-storage.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/use-vault-unlock.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/security-sodium-runtime.spec.ts apps/web/tests/master-password-storage.spec.ts apps/web/tests/vault-page.spec.tsx apps/browser-extension/scripts/build.mjs apps/browser-extension/src/background/unlock-session.ts apps/browser-extension/src/background/unlocked-vault.ts apps/browser-extension/src/popup/App.tsx apps/browser-extension/src/popup/login-payload.ts apps/browser-extension/src/popup/master-password-storage.ts apps/browser-extension/src/popup/use-popup-vault-search.ts apps/browser-extension/tests/security-sodium-runtime.spec.ts apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/packaging-build.spec.ts scripts/secrets/provider.ts tests/dev-secrets-provider.spec.ts
git commit -m "feat: finish secure crypto runtime call chains"
```

## Task 3: Finalize Audit And Launch Handoff

**Files:**
- Modify: `docs/architecture/0005-secure-password-crypto.md`
- Modify: `docs/operations/crypto-review-gate.md`
- Modify: `docs/operations/crypto-legacy-smoke-checklist.md`
- Modify: `docs/operations/secure-crypto-pr-audit-handoff.md`
- Modify: `docs/launch/phase1-launch-checklist.md`
- Modify: `tests/fixtures/crypto-legacy-fixtures.ts`

- [ ] **Step 1: Align the docs with the verified implementation, not the original proposal**

```md
## Verification Result

- Local lint passed on 2026-04-17
- Repo test runner passed on 2026-04-17
- Focused secure-crypto matrix passed on 2026-04-17
```

- [ ] **Step 2: Run a simple sweep to catch obvious weak-path regressions**

Run: `rg -n "Math\\.random|xor|plaintext|stderr" /Users/yuchen/Code/unu/unuvault/packages/security /Users/yuchen/Code/unu/unuvault/apps/web /Users/yuchen/Code/unu/unuvault/apps/browser-extension /Users/yuchen/Code/unu/unuvault/scripts/secrets`

Expected: only intentional documentation text or explicit fail-closed assertions remain; no active weak write path should be reintroduced

- [ ] **Step 3: Update the PR handoff and launch docs with current evidence and residual risks**

```md
## Risks

- Third-party security review is still required before phase 1 launch
- Legacy compatibility depends on user activity to trigger reseal of old values
- Safe rollback must preserve readers for secure `v3` and `v2` payloads
```

- [ ] **Step 4: Re-run only the docs-adjacent verification needed for the handoff**

Run: `./node_modules/.bin/vitest --run tests/dev-secrets-provider.spec.ts packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts`

Expected: PASS, confirming the handoff still reflects the verified helper behavior

- [ ] **Step 5: Commit the audit handoff slice**

```bash
git add docs/architecture/0005-secure-password-crypto.md docs/operations/crypto-review-gate.md docs/operations/crypto-legacy-smoke-checklist.md docs/operations/secure-crypto-pr-audit-handoff.md docs/launch/phase1-launch-checklist.md tests/fixtures/crypto-legacy-fixtures.ts
git commit -m "docs: finalize secure crypto audit handoff"
```

## Task 4: Run The Required Manual Legacy Smoke Before Launch Sign-Off

**Files:**
- Read: `docs/operations/crypto-legacy-smoke-checklist.md`
- Read: `docs/operations/crypto-review-gate.md`
- Read: `docs/launch/phase1-launch-checklist.md`
- Read: `tests/fixtures/crypto-legacy-fixtures.ts`
- Modify: `docs/operations/secure-crypto-pr-audit-handoff.md`

- [ ] **Step 1: Treat manual smoke as a launch gate, not an optional nice-to-have**

```md
## Launch Gate

- Verification that legacy compatibility still behaves as expected on real payloads
- Reuse `docs/operations/crypto-legacy-smoke-checklist.md` for the manual legacy compatibility pass
```

- [ ] **Step 2: Prepare one fixed manual-smoke session using the canonical fixtures**

Run: `sed -n '1,220p' tests/fixtures/crypto-legacy-fixtures.ts`

Expected: confirm the canonical sample set is the one referenced by `docs/operations/crypto-legacy-smoke-checklist.md`; do not invent ad-hoc legacy samples during smoke

- [ ] **Step 3: Execute the manual checklist across Web, extension, and CLI when the local environment is available**

Run: follow `docs/operations/crypto-legacy-smoke-checklist.md`

Expected:
- Web: legacy plaintext and legacy verifier unlock correctly, reveal/copy work, next save rewrites to secure `version: 3`, wrong password fails closed
- Browser extension: popup unlock/search/reveal/copy work on legacy data, stored verifier rewrites to `version: 2`, wrong password fails closed
- CLI: `bash scripts/secrets/provider.sh read --app unundo --env local` prints secrets only to `stdout`, wrong password returns non-zero with `decrypt_failed`, import rewrites to secure `version: 2`

- [ ] **Step 4: Record the manual-smoke result in the audit handoff**

```md
## Verification Result

- Manual legacy smoke completed on YYYY-MM-DD across Web, browser extension, and CLI
- Legacy reads succeeded with the correct password
- Wrong-password paths failed closed with no plaintext leakage
- Successful save, unlock, or import rewrote legacy data to secure versions
```

- [ ] **Step 5: Commit the manual-smoke evidence update**

```bash
git add docs/operations/secure-crypto-pr-audit-handoff.md
git commit -m "docs: record secure crypto manual smoke evidence"
```

## Suggested Execution Split

- `Controller only`
  - final scope decisions
  - review of verification output
  - docs and audit handoff wording
  - manual legacy smoke execution and evidence sign-off
- `Worker A`
  - `packages/security/**` plus `packages/security/tests/**`
- `Worker B`
  - `apps/web/**`, `apps/browser-extension/**`, `scripts/secrets/provider.ts`, and the focused runtime matrix

This split is only for execution mode selection later. Do not dispatch workers until the user explicitly chooses a subagent-driven run.
