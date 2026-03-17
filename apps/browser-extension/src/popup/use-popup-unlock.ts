import { useEffect, useState } from "react";
import {
  createMasterPasswordVerifier,
  type MasterPasswordVerifier,
  verifyMasterPassword,
} from "../../../../packages/security/src/master-password-verifier";
import {
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "./master-password-storage";

export type PopupUnlockMode = "needs_setup" | "locked" | "unlocked";

type PopupUnlockState = {
  draftConfirmPassphrase: string;
  draftPassphrase: string;
  errorMessage: string | null;
  isUnlocked: boolean;
  lock(): void;
  mode: PopupUnlockMode;
  setDraftConfirmPassphrase(value: string): void;
  setDraftPassphrase(value: string): void;
  submitLabel: string;
  submitUnlock(): Promise<boolean>;
  unlockPassphrase: string | null;
};

export function usePopupUnlock(): PopupUnlockState {
  const [storedVerifier, setStoredVerifier] = useState<MasterPasswordVerifier | null>(null);
  const [mode, setMode] = useState<PopupUnlockMode>("needs_setup");
  const [draftPassphrase, setDraftPassphrase] = useState("");
  const [draftConfirmPassphrase, setDraftConfirmPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void readMasterPasswordVerifier().then((verifier) => {
      if (!isActive) {
        return;
      }

      setStoredVerifier(verifier);
      setMode(verifier ? "locked" : "needs_setup");
    });

    return () => {
      isActive = false;
    };
  }, []);

  function updateDraftPassphrase(value: string) {
    setDraftPassphrase(value);
    setErrorMessage(null);
  }

  function updateDraftConfirmPassphrase(value: string) {
    setDraftConfirmPassphrase(value);
    setErrorMessage(null);
  }

  async function submitUnlock(): Promise<boolean> {
    if (!draftPassphrase) {
      setUnlockPassphrase(null);
      setErrorMessage("Master password is required");
      return false;
    }

    if (mode === "needs_setup") {
      if (draftPassphrase !== draftConfirmPassphrase) {
        setUnlockPassphrase(null);
        setErrorMessage("Passwords do not match");
        return false;
      }

      const verifier = createMasterPasswordVerifier(draftPassphrase);

      await writeMasterPasswordVerifier(verifier);
      setStoredVerifier(verifier);
      setUnlockPassphrase(draftPassphrase);
      setDraftConfirmPassphrase("");
      setErrorMessage(null);
      setMode("unlocked");
      return true;
    }

    if (!storedVerifier || !verifyMasterPassword(storedVerifier, draftPassphrase)) {
      setUnlockPassphrase(null);
      setErrorMessage("Wrong master password");
      return false;
    }

    setUnlockPassphrase(draftPassphrase);
    setErrorMessage(null);
    setMode("unlocked");
    return true;
  }

  function lock() {
    setUnlockPassphrase(null);
    setDraftPassphrase("");
    setDraftConfirmPassphrase("");
    setErrorMessage(null);
    setMode(storedVerifier ? "locked" : "needs_setup");
  }

  return {
    draftConfirmPassphrase,
    draftPassphrase,
    errorMessage,
    isUnlocked: unlockPassphrase !== null,
    lock,
    mode,
    setDraftConfirmPassphrase: updateDraftConfirmPassphrase,
    setDraftPassphrase: updateDraftPassphrase,
    submitLabel: mode === "needs_setup" ? "Set master password" : "Unlock vault",
    submitUnlock,
    unlockPassphrase,
  };
}
