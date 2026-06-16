"use client";

import { useMemo, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import {
  createMasterPasswordVerifier,
  type MasterPasswordVerifier,
  verifyMasterPassword,
} from "../../../../../packages/security/src/master-password-verifier";
import {
  isPassphraseProtectedVaultPassword,
  openStoredVaultPassword,
} from "../../../../../packages/security/src/vault-envelope";
import { useWebCopy } from "../../lib/i18n/use-web-copy";
import { hasSavedPassword, normalizeVaultLoginPayload } from "./login-payload";
import {
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "./master-password-storage";

type VaultUnlockMode = "needs_setup" | "locked" | "unlocked";

type VaultUnlockState = {
  draftConfirmPassphrase: string;
  draftPassphrase: string;
  hasSavedPasswords: boolean;
  isUnlocked: boolean;
  lock(): void;
  mode: VaultUnlockMode;
  submitLabel: string;
  submitUnlock(): Promise<boolean>;
  setDraftConfirmPassphrase(value: string): void;
  setDraftPassphrase(value: string): void;
  unlockError: string | null;
  unlockPassphrase: string | null;
};

export function useVaultUnlock(items: VaultSyncItem[]): VaultUnlockState {
  const copy = useWebCopy().vault.unlock;
  const [storedVerifier, setStoredVerifier] = useState<MasterPasswordVerifier | null>(() =>
    readMasterPasswordVerifier(),
  );
  const [mode, setMode] = useState<VaultUnlockMode>(() =>
    readMasterPasswordVerifier() ? "locked" : "needs_setup",
  );
  const [draftConfirmPassphrase, setDraftConfirmPassphrase] = useState("");
  const [draftPassphrase, setDraftPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const hasSavedPasswords = useMemo(
    () => items.some((item) => hasSavedPassword(item.encrypted_payload)),
    [items],
  );

  const protectedCiphertexts = useMemo(
    () =>
      items
        .map((item) => normalizeVaultLoginPayload(item.encrypted_payload).password_ciphertext)
        .filter((ciphertext) => isPassphraseProtectedVaultPassword(ciphertext)),
    [items],
  );

  async function canUnlockProtectedCiphertexts(passphrase: string): Promise<boolean> {
    const openedPasswords = await Promise.all(
      protectedCiphertexts.map((ciphertext) =>
        openStoredVaultPassword(ciphertext, passphrase),
      ),
    );

    return openedPasswords.every((password) => password.length > 0);
  }

  function updateDraftPassphrase(value: string) {
    setDraftPassphrase(value);
    setUnlockError(null);
  }

  function updateDraftConfirmPassphrase(value: string) {
    setDraftConfirmPassphrase(value);
    setUnlockError(null);
  }

  async function submitUnlock(): Promise<boolean> {
    if (!draftPassphrase) {
      setUnlockPassphrase(null);
      setUnlockError(copy.requiredError);
      return false;
    }

    if (mode === "needs_setup") {
      if (draftPassphrase !== draftConfirmPassphrase) {
        setUnlockPassphrase(null);
        setUnlockError(copy.mismatchError);
        return false;
      }

      if (
        protectedCiphertexts.length > 0 &&
        !(await canUnlockProtectedCiphertexts(draftPassphrase))
      ) {
        setUnlockPassphrase(null);
        setUnlockError(copy.existingPasswordError);
        return false;
      }

      const verifier = await createMasterPasswordVerifier(draftPassphrase);

      writeMasterPasswordVerifier(verifier);
      setStoredVerifier(verifier);
      setUnlockPassphrase(draftPassphrase);
      setUnlockError(null);
      setDraftConfirmPassphrase("");
      setMode("unlocked");
      return true;
    }

    const verificationResult = storedVerifier
      ? await verifyMasterPassword(storedVerifier, draftPassphrase)
      : { success: false as const };

    if (!verificationResult.success) {
      setUnlockPassphrase(null);
      setUnlockError(copy.wrongPasswordError);
      return false;
    }

    if (
      protectedCiphertexts.length > 0 &&
      !(await canUnlockProtectedCiphertexts(draftPassphrase))
    ) {
      setUnlockPassphrase(null);
      setUnlockError(copy.wrongPasswordError);
      return false;
    }

    if (verificationResult.upgradedVerifier) {
      writeMasterPasswordVerifier(verificationResult.upgradedVerifier);
      setStoredVerifier(verificationResult.upgradedVerifier);
    }

    setUnlockPassphrase(draftPassphrase);
    setUnlockError(null);
    setMode("unlocked");
    return true;
  }

  function lock() {
    setUnlockPassphrase(null);
    setDraftPassphrase("");
    setDraftConfirmPassphrase("");
    setUnlockError(null);
    setMode(storedVerifier ? "locked" : "needs_setup");
  }

  return {
    draftConfirmPassphrase,
    draftPassphrase,
    hasSavedPasswords,
    isUnlocked: unlockPassphrase !== null,
    lock,
    mode,
    submitLabel:
      mode === "needs_setup" ? copy.setMasterPassword : copy.unlockVault,
    submitUnlock,
    setDraftConfirmPassphrase: updateDraftConfirmPassphrase,
    setDraftPassphrase: updateDraftPassphrase,
    unlockError,
    unlockPassphrase,
  };
}
