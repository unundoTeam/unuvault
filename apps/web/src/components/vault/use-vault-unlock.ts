"use client";

import { useMemo, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import { hasSavedPassword } from "./login-payload";

type VaultUnlockState = {
  draftPassphrase: string;
  hasSavedPasswords: boolean;
  isUnlocked: boolean;
  setDraftPassphrase(value: string): void;
  submitLabel: string;
  unlockError: string | null;
};

export function useVaultUnlock(items: VaultSyncItem[]): VaultUnlockState {
  const [draftPassphrase, setDraftPassphrase] = useState("");
  const [unlockError] = useState<string | null>(null);

  const hasSavedPasswords = useMemo(
    () => items.some((item) => hasSavedPassword(item.encrypted_payload)),
    [items],
  );

  return {
    draftPassphrase,
    hasSavedPasswords,
    isUnlocked: false,
    setDraftPassphrase,
    submitLabel: hasSavedPasswords ? "Unlock vault" : "Set unlock passphrase",
    unlockError,
  };
}
