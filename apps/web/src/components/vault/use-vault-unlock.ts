"use client";

import { useMemo, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import {
  isPassphraseProtectedVaultPassword,
  openStoredVaultPassword,
} from "../../../../../packages/security/src/vault-envelope";
import { hasSavedPassword, normalizeVaultLoginPayload } from "./login-payload";

type VaultUnlockState = {
  draftPassphrase: string;
  hasSavedPasswords: boolean;
  isUnlocked: boolean;
  lock(): void;
  submitLabel: string;
  submitUnlock(): boolean;
  setDraftPassphrase(value: string): void;
  unlockError: string | null;
  unlockPassphrase: string | null;
};

export function useVaultUnlock(items: VaultSyncItem[]): VaultUnlockState {
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

  function updateDraftPassphrase(value: string) {
    setDraftPassphrase(value);
    setUnlockError(null);
  }

  function submitUnlock(): boolean {
    if (!draftPassphrase) {
      setUnlockPassphrase(null);
      setUnlockError("Unlock passphrase is required");
      return false;
    }

    if (
      protectedCiphertexts.length > 0 &&
      !protectedCiphertexts.every(
        (ciphertext) => openStoredVaultPassword(ciphertext, draftPassphrase).length > 0,
      )
    ) {
      setUnlockPassphrase(null);
      setUnlockError("Wrong unlock passphrase");
      return false;
    }

    setUnlockPassphrase(draftPassphrase);
    setUnlockError(null);
    return true;
  }

  function lock() {
    setUnlockPassphrase(null);
    setDraftPassphrase("");
    setUnlockError(null);
  }

  return {
    draftPassphrase,
    hasSavedPasswords,
    isUnlocked: unlockPassphrase !== null,
    lock,
    submitLabel: hasSavedPasswords ? "Unlock vault" : "Set unlock passphrase",
    submitUnlock,
    setDraftPassphrase: updateDraftPassphrase,
    unlockError,
    unlockPassphrase,
  };
}
