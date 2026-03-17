import type {
  AutofillCandidates,
  AutofillFillData,
  AutofillStatus,
  BackgroundRequest,
  BackgroundResponse,
} from "../background/protocol";
import { handleBackgroundRequest } from "../background/runtime";

type ContentAutofillStatus =
  | AutofillStatus
  | {
      status: "unavailable";
    };

type ContentAutofillCandidates =
  | AutofillCandidates
  | {
      status: "unavailable";
    };

type ContentAutofillFillData =
  | AutofillFillData
  | {
      status: "unavailable";
    };

type ContentAutofillAttemptResult =
  | ContentAutofillFillData
  | {
      status: "no_fillable_fields";
    }
  | {
      status: "filled";
      filledUsername: boolean;
      filledPassword: boolean;
    };

type ExtensionRuntime = {
  sendMessage?(request: BackgroundRequest): Promise<BackgroundResponse>;
};

function getExtensionRuntime(): ExtensionRuntime | null {
  return (
    (globalThis as {
      chrome?: {
        runtime?: ExtensionRuntime;
      };
    }).chrome?.runtime ?? null
  );
}

async function callBackground(request: BackgroundRequest): Promise<BackgroundResponse> {
  const runtime = getExtensionRuntime();

  if (runtime?.sendMessage) {
    return runtime.sendMessage(request);
  }

  return handleBackgroundRequest(request);
}

export function shouldOfferAutofill(input: { hasPasswordField: boolean }) {
  return input.hasPasswordField;
}

export async function readAutofillStatus(): Promise<ContentAutofillStatus> {
  try {
    const response = await callBackground({
      type: "read_autofill_status",
    });

    if (!response.ok || !("autofillStatus" in response)) {
      return {
        status: "unavailable",
      };
    }

    return response.autofillStatus;
  } catch {
    return {
      status: "unavailable",
    };
  }
}

export async function readAutofillCandidates(
  pageUrl: string,
): Promise<ContentAutofillCandidates> {
  try {
    const response = await callBackground({
      type: "read_autofill_candidates",
      pageUrl,
    });

    if (!response.ok || !("autofillCandidates" in response)) {
      return {
        status: "unavailable",
      };
    }

    return response.autofillCandidates;
  } catch {
    return {
      status: "unavailable",
    };
  }
}

export async function readAutofillFillData(
  pageUrl: string,
): Promise<ContentAutofillFillData> {
  try {
    const response = await callBackground({
      type: "read_autofill_fill_data",
      pageUrl,
    });

    if (!response.ok || !("autofillFillData" in response)) {
      return {
        status: "unavailable",
      };
    }

    return response.autofillFillData;
  } catch {
    return {
      status: "unavailable",
    };
  }
}

function isVisibleInput(input: HTMLInputElement) {
  return input.getClientRects().length > 0;
}

function isFillableInput(input: HTMLInputElement) {
  if (input.disabled || input.readOnly) {
    return false;
  }

  if (input.type === "hidden") {
    return false;
  }

  return isVisibleInput(input);
}

function findFirstFillableInput(
  inputs: HTMLInputElement[],
  predicate: (input: HTMLInputElement) => boolean,
) {
  return inputs.find((input) => isFillableInput(input) && predicate(input)) ?? null;
}

function hasFieldHint(input: HTMLInputElement) {
  const identifier = `${input.name} ${input.id}`.toLowerCase();

  return (
    identifier.includes("user") ||
    identifier.includes("email") ||
    identifier.includes("login")
  );
}

function findUsernameField(document: Document) {
  const inputs = Array.from(document.querySelectorAll("input"));

  return (
    findFirstFillableInput(
      inputs,
      (input) => input.autocomplete.toLowerCase() === "username",
    ) ??
    findFirstFillableInput(
      inputs,
      (input) => input.autocomplete.toLowerCase() === "email",
    ) ??
    findFirstFillableInput(inputs, (input) => input.type === "email") ??
    findFirstFillableInput(inputs, hasFieldHint) ??
    findFirstFillableInput(inputs, (input) => input.type === "text")
  );
}

function findPasswordField(document: Document) {
  const inputs = Array.from(document.querySelectorAll("input"));

  return findFirstFillableInput(inputs, (input) => input.type === "password");
}

function dispatchAutofillEvents(input: HTMLInputElement) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function attemptAutofillForCurrentPage(input: {
  document: Document;
  pageUrl: string;
}): Promise<ContentAutofillAttemptResult> {
  const fillData = await readAutofillFillData(input.pageUrl);

  if (fillData.status !== "ready") {
    return fillData;
  }

  const usernameField = findUsernameField(input.document);
  const passwordField = findPasswordField(input.document);
  let filledUsername = false;
  let filledPassword = false;

  if (usernameField && fillData.fillData.username) {
    usernameField.value = fillData.fillData.username;
    dispatchAutofillEvents(usernameField);
    filledUsername = true;
  }

  if (passwordField && fillData.fillData.password) {
    passwordField.value = fillData.fillData.password;
    dispatchAutofillEvents(passwordField);
    filledPassword = true;
  }

  if (!filledUsername && !filledPassword) {
    return {
      status: "no_fillable_fields",
    };
  }

  return {
    status: "filled",
    filledUsername,
    filledPassword,
  };
}
