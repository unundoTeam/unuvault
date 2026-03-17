import { useEffect, useState } from "react";
import type { ExtensionAuthState } from "../background/auth";
import {
  hydratePopupVaultCacheInBackground,
  readExtensionAuthStateFromBackground,
  signInWithPasswordInBackground,
} from "./background-client";

type PopupAuthStatus = "loading" | "signed_out" | "signing_in" | "signed_in";

type PopupAuthState = {
  authErrorMessage: string | null;
  draftEmail: string;
  draftPassword: string;
  isSignedIn: boolean;
  setDraftEmail(value: string): void;
  setDraftPassword(value: string): void;
  signIn(): Promise<boolean>;
  status: PopupAuthStatus;
  vaultErrorMessage: string | null;
};

function isSignedInState(authState: ExtensionAuthState): boolean {
  return authState.status === "signed_in";
}

export function usePopupAuth(): PopupAuthState {
  const [status, setStatus] = useState<PopupAuthStatus>("loading");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [vaultErrorMessage, setVaultErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadAuthState() {
      try {
        const authState = await readExtensionAuthStateFromBackground();

        if (!isActive) {
          return;
        }

        if (!isSignedInState(authState)) {
          setStatus("signed_out");
          setVaultErrorMessage(null);
          return;
        }

        setStatus("signed_in");

        try {
          await hydratePopupVaultCacheInBackground();

          if (isActive) {
            setVaultErrorMessage(null);
          }
        } catch (error) {
          if (isActive) {
            setVaultErrorMessage(
              error instanceof Error ? error.message : "We couldn't refresh your vault.",
            );
          }
        }
      } catch {
        if (isActive) {
          setStatus("signed_out");
          setAuthErrorMessage("We couldn't sign you in. Please try again.");
        }
      }
    }

    void loadAuthState();

    return () => {
      isActive = false;
    };
  }, []);

  async function signIn(): Promise<boolean> {
    if (!draftEmail.trim() || !draftPassword.trim()) {
      setAuthErrorMessage("Email and password are required.");
      return false;
    }

    setStatus("signing_in");
    setAuthErrorMessage(null);

    try {
      const authState = await signInWithPasswordInBackground({
        email: draftEmail,
        password: draftPassword,
      });

      if (!isSignedInState(authState)) {
        throw new Error("missing signed-in state");
      }

      setStatus("signed_in");

      try {
        await hydratePopupVaultCacheInBackground();
        setVaultErrorMessage(null);
      } catch (error) {
        setVaultErrorMessage(
          error instanceof Error ? error.message : "We couldn't refresh your vault.",
        );
      }

      return true;
    } catch {
      setStatus("signed_out");
      setAuthErrorMessage("We couldn't sign you in. Please try again.");
      return false;
    }
  }

  return {
    authErrorMessage,
    draftEmail,
    draftPassword,
    isSignedIn: status === "signed_in",
    setDraftEmail(value: string) {
      setDraftEmail(value);
      setAuthErrorMessage(null);
    },
    setDraftPassword(value: string) {
      setDraftPassword(value);
      setAuthErrorMessage(null);
    },
    signIn,
    status,
    vaultErrorMessage,
  };
}
