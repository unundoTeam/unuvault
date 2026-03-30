import { useEffect, useState } from "react";
import {
  lockExtensionVaultInBackground,
  readExtensionUnlockStateFromBackground,
  unlockExtensionVaultInBackground,
} from "./background-client";

export type PopupUnlockMode = "needs_setup" | "locked" | "unlocked";

type PopupUnlockState = {
  draftConfirmPassphrase: string;
  draftPassphrase: string;
  errorMessage: string | null;
  isUnlocked: boolean;
  lock(): Promise<void>;
  mode: PopupUnlockMode;
  setDraftConfirmPassphrase(value: string): void;
  setDraftPassphrase(value: string): void;
  submitLabel: string;
  submitUnlock(): Promise<boolean>;
  unlockPassphrase: string | null;
};

export function usePopupUnlock(): PopupUnlockState {
  const [mode, setMode] = useState<PopupUnlockMode>("needs_setup");
  const [draftPassphrase, setDraftPassphrase] = useState("");
  const [draftConfirmPassphrase, setDraftConfirmPassphrase] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockPassphrase, setUnlockPassphrase] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void readExtensionUnlockStateFromBackground()
      .then((unlockState) => {
        if (!isActive) {
          return;
        }

        setMode(unlockState.mode);
        if (unlockState.mode !== "unlocked") {
          setUnlockPassphrase(null);
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setMode("needs_setup");
        setUnlockPassphrase(null);
        setErrorMessage("We couldn't unlock your vault. Please try again.");
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
      setErrorMessage("Master password is required");
      return false;
    }

    if (mode === "needs_setup" && draftPassphrase !== draftConfirmPassphrase) {
      setErrorMessage("Passwords do not match");
      return false;
    }

    try {
      const unlockState = await unlockExtensionVaultInBackground(draftPassphrase);

      setMode(unlockState.mode);
      setUnlockPassphrase(unlockState.mode === "unlocked" ? draftPassphrase : null);
      setDraftPassphrase("");
      setDraftConfirmPassphrase("");
      setErrorMessage(null);

      return unlockState.mode === "unlocked";
    } catch (error) {
      setUnlockPassphrase(null);
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't unlock your vault. Please try again.",
      );
      return false;
    }
  }

  async function lock() {
    try {
      const unlockState = await lockExtensionVaultInBackground();

      setMode(unlockState.mode);
      setUnlockPassphrase(null);
      setDraftPassphrase("");
      setDraftConfirmPassphrase("");
      setErrorMessage(null);
    } catch {
      setErrorMessage("We couldn't lock your vault. Please try again.");
    }
  }

  return {
    draftConfirmPassphrase,
    draftPassphrase,
    errorMessage,
    isUnlocked: mode === "unlocked",
    lock,
    mode,
    setDraftConfirmPassphrase: updateDraftConfirmPassphrase,
    setDraftPassphrase: updateDraftPassphrase,
    submitLabel: mode === "needs_setup" ? "Set master password" : "Unlock vault",
    submitUnlock,
    unlockPassphrase,
  };
}
