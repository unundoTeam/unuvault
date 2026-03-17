import type { ExtensionAuthState } from "./auth";
import type { ExtensionUnlockState } from "./unlock-session";

export type AutofillStatus =
  | {
      status: "signed_out";
    }
  | {
      status: "locked";
    }
  | {
      status: "empty";
    }
  | {
      status: "ready";
    };

export type BackgroundRequest =
  | {
      type: "read_extension_auth_state";
    }
  | {
      type: "read_extension_unlock_state";
    }
  | {
      type: "sign_in_with_password";
      email: string;
      password: string;
    }
  | {
      type: "unlock_extension_vault";
      passphrase: string;
    }
  | {
      type: "lock_extension_vault";
    }
  | {
      type: "read_autofill_status";
    }
  | {
      type: "hydrate_popup_vault_cache";
    }
  | {
      type: "sign_out";
    };

export type BackgroundResponse =
  | {
      ok: true;
      authState: ExtensionAuthState;
    }
  | {
      ok: true;
      unlockState: ExtensionUnlockState;
    }
  | {
      ok: true;
      autofillStatus: AutofillStatus;
    }
  | {
      ok: true;
      result: {
        ok: boolean;
      };
    }
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };
