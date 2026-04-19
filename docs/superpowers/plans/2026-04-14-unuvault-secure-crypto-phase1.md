# unuvault Secure Crypto Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current placeholder vault-password, master-password-verifier, and developer-secret crypto helpers with a versioned async security boundary that preserves current server contracts, supports legacy reads, and adds explicit audit/release gates.

**Architecture:** Keep server payloads opaque and unchanged while moving all new client-side writes to versioned envelopes backed by a shared async crypto core. Land the work in three chunks: first prove the chosen sodium-based substrate works in Node, Next.js, and the browser extension; then migrate security helpers and UI call chains to async upgrade-aware flows; finally lock the slice with CLI coverage, ADRs, and release-gate docs.

**Tech Stack:** pnpm workspace, TypeScript, Vitest, React, Next.js, browser extension runtime, `libsodium-wrappers-sumo`

---

## File Structure Map

- `packages/security/package.json`
  - add the sodium dependency used by the new async crypto core
- `packages/security/src/crypto-core.ts`
  - new shared async crypto substrate, sodium init, RNG, KDF, AEAD helpers
- `packages/security/src/vault-envelope.ts`
  - versioned vault password codec, legacy-read support, latest-write path
- `packages/security/src/master-password-verifier.ts`
  - versioned verifier codec plus upgrade-aware verify path
- `packages/security/src/developer-secret-envelope.ts`
  - versioned dev secret codec using the same secure primitives with its own tag
- `packages/security/tests/*.spec.ts`
  - unit coverage for secure writes, fail-closed behavior, legacy reads, and upgrades
- `apps/web/src/components/vault/*.ts*`
  - async unlock, async payload reads, event-driven reveal/edit flows, verifier rewrites
- `apps/web/tests/*.spec.ts*`
  - web setup/unlock/edit/reveal regression coverage under async helpers
- `apps/browser-extension/src/background/*.ts`
  - async unlock runtime and unlocked vault reader
- `apps/browser-extension/src/popup/*.ts*`
  - async popup unlock/search/read behavior
- `apps/browser-extension/tests/*.spec.ts*`
  - extension regression coverage for unlock, search, reveal, and autofill reads
- `scripts/secrets/provider.ts`
  - async read/import flow with no-plaintext-on-stderr guarantees
- `tests/dev-secrets-provider.spec.ts`
  - CLI regression coverage
- `docs/architecture/0005-secure-password-crypto.md`
  - ADR for algorithms, compatibility posture, and residual risks
- `docs/operations/crypto-review-gate.md`
  - internal audit checklist and pre-release gate
- `docs/launch/phase1-launch-checklist.md`
  - launch checklist entry that separates this slice from third-party audit gate

## Chunk 1: Prove and Build the Security Substrate

### Task 1: Prove the chosen sodium package works in every required runtime before touching call sites

**Files:**
- Modify: `packages/security/package.json`
- Create: `packages/security/src/crypto-core.ts`
- Create: `packages/security/tests/crypto-core.spec.ts`

- [ ] **Step 1: Write the failing substrate smoke test**

```ts
import { describe, expect, it } from "vitest";
import {
  ensureCryptoReady,
  getAeadNonceBytes,
  randomBytes,
  deriveEnvelopeKey,
  createPasswordVerifierMaterial,
  verifyPasswordVerifierMaterial,
} from "../src/crypto-core";

describe("crypto-core", () => {
  it("loads sodium and exposes the required primitives", async () => {
    await ensureCryptoReady();
    expect(getAeadNonceBytes()).toBeGreaterThan(0);
  });

  it("derives an envelope key and verifies password material", async () => {
    const salt = randomBytes(16);
    const key = await deriveEnvelopeKey("correct horse", salt, "vault-password");
    expect(key).toHaveLength(32);

    const verifier = await createPasswordVerifierMaterial("correct horse");
    await expect(
      verifyPasswordVerifierMaterial(verifier, "correct horse"),
    ).resolves.toBe(true);
  });
});
```

- [ ] **Step 2: Add the sodium dependency and minimal async wrapper**

```ts
import sodium from "libsodium-wrappers-sumo";

let ready: Promise<typeof sodium> | null = null;

export async function ensureCryptoReady() {
  ready ??= sodium.ready.then(() => sodium);
  return ready;
}
```

- [ ] **Step 3: Run the substrate smoke test**

Run: `pnpm vitest --run packages/security/tests/crypto-core.spec.ts`
Expected: PASS, proving the package exposes the Argon2id and XChaCha20-Poly1305 primitives needed by Web, extension, and CLI flows

- [ ] **Step 4: Stop and re-scope if the smoke test fails**

Run: `pnpm --filter @unuvault/security lint`
Expected: PASS if the async wrapper compiles; if the runtime cannot expose the required KDF or AEAD APIs, do not migrate call sites yet

- [ ] **Step 5: Commit**

```bash
git add packages/security/package.json packages/security/src/crypto-core.ts packages/security/tests/crypto-core.spec.ts
git commit -m "chore: prove sodium crypto substrate"
```

### Task 2: Replace the three weak helper families with versioned async secure codecs

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/src/master-password-verifier.ts`
- Modify: `packages/security/src/developer-secret-envelope.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`
- Modify: `packages/security/tests/master-password-verifier.spec.ts`
- Modify: `packages/security/tests/developer-secret-envelope.spec.ts`
- Reuse: `packages/security/src/crypto-core.ts`

- [ ] **Step 1: Write the failing version and upgrade tests**

```ts
it("writes only vault envelope version 3", async () => {
  const sealed = await sealVaultPassword("hunter2", "correct horse");
  expect(JSON.parse(sealed)).toMatchObject({
    version: 3,
    cipher: "xchacha20-poly1305",
    kdf: "argon2id",
  });
});

it("verifies a legacy verifier and returns upgrade material", async () => {
  const legacy = { version: 1, salt: "abc", check: "def" };
  const result = await verifyMasterPassword(legacy, "correct horse");
  expect(result.ok).toBe(true);
  expect(result.upgradedVerifier).toMatchObject({ version: 2 });
});
```

- [ ] **Step 2: Implement versioned unions and internal result types**

```ts
export type VaultEnvelope =
  | LegacyVaultEnvelopeV1
  | WeakVaultEnvelopeV2
  | SecureVaultEnvelopeV3;

export type VerifyMasterPasswordResult =
  | { ok: false }
  | { ok: true; upgradedVerifier: MasterPasswordVerifierV2 | null };
```

- [ ] **Step 3: Keep legacy reads but force latest writes**

```ts
export async function openStoredVaultPassword(ciphertext: string, passphrase?: string) {
  if (!ciphertext) return "";
  if (looksLikeLegacyPlaintext(ciphertext)) return ciphertext;
  return openVaultPassword(ciphertext, passphrase);
}
```

- [ ] **Step 4: Add fail-closed coverage for wrong passwords, malformed payloads, and missing secure RNG**

Run: `pnpm vitest --run packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts`
Expected: PASS with explicit cases for legacy plaintext, legacy envelope, legacy verifier, malformed JSON, wrong password, and missing secure RNG

- [ ] **Step 5: Commit**

```bash
git add packages/security/src/vault-envelope.ts packages/security/src/master-password-verifier.ts packages/security/src/developer-secret-envelope.ts packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts
git commit -m "feat: replace weak security helpers with async secure codecs"
```

## Chunk 2: Migrate Product Call Chains to Async Upgrade-Aware Flows

### Task 3: Move the Web vault surface to async unlock and event-driven decrypt flows

**Files:**
- Modify: `apps/web/src/components/vault/master-password-storage.ts`
- Modify: `apps/web/src/components/vault/use-vault-unlock.ts`
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/master-password-storage.spec.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing web behavior tests**

```ts
it("upgrades a legacy verifier after a successful unlock", async () => {
  render(<VaultPanel />);
  await user.type(screen.getByLabelText(/master password/i), "correct horse");
  await user.click(screen.getByRole("button", { name: /unlock vault/i }));
  await waitFor(() => expect(readStoredVerifierVersion()).toBe(2));
});

it("reveals passwords only through an async event path", async () => {
  await user.click(screen.getByRole("button", { name: /show password/i }));
  expect(await screen.findByDisplayValue("hunter2")).toBeVisible();
});
```

- [ ] **Step 2: Convert storage and unlock helpers to async**

```ts
export async function readMasterPasswordVerifier() {
  // parse localStorage payload, accept v1/v2, return null on malformed input
}

export function useVaultUnlock(items: VaultSyncItem[]) {
  // initialize from effect, await verifier reads and unlock checks
}
```

- [ ] **Step 3: Remove render-time decrypt calls and keep plaintext in short-lived UI state only**

```ts
const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

async function revealPassword(item: VaultSyncItem) {
  const password = await readDraftPassword(item.encrypted_payload, unlockPassphrase ?? undefined);
  setRevealedPasswords((current) => ({ ...current, [item.id]: password }));
}
```

- [ ] **Step 4: Verify save and edit paths always write the latest envelope version**

Run: `pnpm vitest --run apps/web/tests/master-password-storage.spec.ts apps/web/tests/vault-page.spec.tsx`
Expected: PASS for setup, unlock, re-lock, create, edit, reveal, copy, and legacy-to-latest rewrite flows

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/vault/master-password-storage.ts apps/web/src/components/vault/use-vault-unlock.ts apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/master-password-storage.spec.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: migrate web vault flows to async secure crypto"
```

### Task 4: Move the browser extension unlock, search, and autofill readers to async decrypt helpers

**Files:**
- Modify: `apps/browser-extension/src/background/unlock-session.ts`
- Modify: `apps/browser-extension/src/background/unlocked-vault.ts`
- Modify: `apps/browser-extension/src/popup/master-password-storage.ts`
- Modify: `apps/browser-extension/src/popup/login-payload.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/tests/background-unlock.spec.ts`
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
- Modify: `apps/browser-extension/tests/master-password-storage.spec.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Write the failing extension regression tests**

```ts
it("upgrades a legacy verifier in background unlock flow", async () => {
  const result = await runtime.unlockWithPassphrase("correct horse");
  expect(result.ok).toBe(true);
  expect(await readStoredVerifierVersion()).toBe(2);
});

it("reveals a password from popup search through an awaited decrypt path", async () => {
  await user.click(screen.getByRole("button", { name: /show password/i }));
  expect(await screen.findByDisplayValue("hunter2")).toBeVisible();
});
```

- [ ] **Step 2: Make background unlock runtime await verifier creation and verification**

```ts
const verifyResult = await resolvedDeps.verifyMasterPassword(verifier, passphrase);
if (!verifyResult.ok) {
  return lockedErrorResult;
}
if (verifyResult.upgradedVerifier) {
  await resolvedDeps.writeMasterPasswordVerifier(verifyResult.upgradedVerifier);
}
```

- [ ] **Step 3: Make popup search and unlocked-vault readers await decrypt operations**

```ts
const password = await openStoredVaultPassword(payload.password_ciphertext, passphrase);
```

- [ ] **Step 4: Verify popup behavior, background reads, and autofill-safe readers**

Run: `pnpm vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS for setup, unlock, reveal, search, copy, and unlocked background reads under the new async helpers

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension/src/background/unlock-session.ts apps/browser-extension/src/background/unlocked-vault.ts apps/browser-extension/src/popup/master-password-storage.ts apps/browser-extension/src/popup/login-payload.ts apps/browser-extension/src/popup/use-popup-unlock.ts apps/browser-extension/src/popup/use-popup-vault-search.ts apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: migrate extension vault flows to async secure crypto"
```

## Chunk 3: Finish the CLI, Docs, and Release Gates

### Task 5: Keep the dev-secrets CLI UX stable while switching its crypto path to async fail-closed behavior

**Files:**
- Modify: `scripts/secrets/provider.ts`
- Modify: `tests/dev-secrets-provider.spec.ts`

- [ ] **Step 1: Write the failing CLI regression tests**

```ts
it("prints dotenv only to stdout on successful read", async () => {
  const exitCode = await runDevSecretsProvider(["read", "--app", "unundo", "--env", "local"], options);
  expect(exitCode).toBe(0);
  expect(readStdout()).toContain("SUPABASE_URL=");
  expect(readStderr()).toBe("");
});

it("does not leak plaintext on decrypt failure", async () => {
  expect(readStderr()).toContain("decrypt_failed");
  expect(readStderr()).not.toContain("SUPABASE_URL=");
});
```

- [ ] **Step 2: Await the new helper functions in read/import flows**

```ts
const plaintext = await openDeveloperSecretBlob(record.ciphertext, masterPassword);
const ciphertext = await sealDeveloperSecretBlob(plaintext, masterPassword);
```

- [ ] **Step 3: Verify read/import behavior stays stable**

Run: `pnpm vitest --run tests/dev-secrets-provider.spec.ts`
Expected: PASS for `read`, `import`, wrong password, malformed payload, and safe stderr behavior

- [ ] **Step 4: Commit**

```bash
git add scripts/secrets/provider.ts tests/dev-secrets-provider.spec.ts
git commit -m "feat: migrate dev secrets provider to async secure crypto"
```

### Task 6: Write the ADR and release gate docs before calling the slice complete

**Files:**
- Create: `docs/architecture/0005-secure-password-crypto.md`
- Create: `docs/operations/crypto-review-gate.md`
- Modify: `docs/launch/phase1-launch-checklist.md`

- [ ] **Step 1: Write the ADR with algorithm and compatibility decisions**

```md
- vault and developer secret writes use XChaCha20-Poly1305
- password-derived keys use Argon2id
- legacy plaintext, XOR envelopes, and v1 verifier remain read-compatible only
- new writes always emit the latest secure version
```

- [ ] **Step 2: Write the crypto review gate document**

```md
- internal design review completed
- threat model reviewed
- unit and surface regression suites passed
- residual risks documented
- third-party audit remains a pre-launch gate, not a code-complete condition
```

- [ ] **Step 3: Update the launch checklist to point at the new gate**

Run: `rg -n "audit|crypto|review gate" docs/launch/phase1-launch-checklist.md docs/operations/crypto-review-gate.md docs/architecture/0005-secure-password-crypto.md`
Expected: every document cross-references the new internal-review and external-audit split

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/0005-secure-password-crypto.md docs/operations/crypto-review-gate.md docs/launch/phase1-launch-checklist.md
git commit -m "docs: add secure crypto adr and release gate"
```

### Task 7: Run the full slice verification and freeze out old sync crypto assumptions

**Files:**
- Reuse: `packages/security/tests/*.spec.ts`
- Reuse: `apps/web/tests/*.spec.ts`
- Reuse: `apps/browser-extension/tests/*.spec.ts`
- Reuse: `tests/dev-secrets-provider.spec.ts`

- [ ] **Step 1: Run the focused test matrix**

Run: `pnpm vitest --run packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts packages/security/tests/crypto-core.spec.ts apps/web/tests/master-password-storage.spec.ts apps/web/tests/vault-page.spec.tsx apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/popup.spec.tsx tests/dev-secrets-provider.spec.ts`
Expected: PASS

- [ ] **Step 2: Run repo-level lint and test gates**

Run: `pnpm lint && pnpm test`
Expected: PASS

- [ ] **Step 3: Grep for stale sync helper assumptions before merge**

Run: `rg -n "openStoredVaultPassword\\(|openVaultPassword\\(|sealVaultPassword\\(|createMasterPasswordVerifier\\(|verifyMasterPassword\\(|sealDeveloperSecretBlob\\(|openDeveloperSecretBlob\\(" apps packages scripts tests`
Expected: every remaining call site explicitly uses `await` or is inside an async helper that returns a promise

- [ ] **Step 4: Commit**

```bash
git add packages/security apps/web apps/browser-extension scripts/secrets/provider.ts tests/dev-secrets-provider.spec.ts docs/architecture/0005-secure-password-crypto.md docs/operations/crypto-review-gate.md docs/launch/phase1-launch-checklist.md
git commit -m "test: verify secure crypto migration gates"
```

Plan complete and saved to `docs/superpowers/plans/2026-04-14-unuvault-secure-crypto-phase1.md`. Ready to execute.
