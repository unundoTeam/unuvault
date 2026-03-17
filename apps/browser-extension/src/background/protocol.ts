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

export type AutofillCandidate = {
  hasPassword: boolean;
  id: string;
  title: string;
  username: string;
  websiteOrigin: string;
  websiteUrl: string;
};

export type AutofillCandidates =
  | {
      status: "signed_out";
      matches: [];
    }
  | {
      status: "locked";
      matches: [];
    }
  | {
      status: "no_page_url";
      matches: [];
    }
  | {
      status: "no_match";
      matches: [];
    }
  | {
      status: "ready";
      matches: AutofillCandidate[];
    };

export type AutofillFillData =
  | {
      status: "signed_out";
    }
  | {
      status: "locked";
    }
  | {
      status: "no_page_url";
    }
  | {
      status: "no_match";
    }
  | {
      status: "multiple_matches";
      count: number;
    }
  | {
      status: "no_password";
    }
  | {
      status: "ready";
      fillData: {
        username: string;
        password: string;
      };
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
      type: "read_autofill_candidates";
      pageUrl: string;
    }
  | {
      type: "read_autofill_fill_data";
      pageUrl: string;
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
      autofillCandidates: AutofillCandidates;
    }
  | {
      ok: true;
      autofillFillData: AutofillFillData;
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
