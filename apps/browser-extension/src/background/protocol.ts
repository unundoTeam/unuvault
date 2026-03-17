import type { ExtensionAuthState } from "./auth";

export type BackgroundRequest =
  | {
      type: "read_extension_auth_state";
    }
  | {
      type: "sign_in_with_password";
      email: string;
      password: string;
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
