import type { ExtensionAuthState } from "./auth";
import type { ExtensionUnlockState } from "./unlock-session";

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
