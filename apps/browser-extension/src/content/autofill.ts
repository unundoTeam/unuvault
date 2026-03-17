import type { AutofillStatus, BackgroundRequest, BackgroundResponse } from "../background/protocol";
import { handleBackgroundRequest } from "../background/runtime";

type ContentAutofillStatus =
  | AutofillStatus
  | {
      status: "unavailable";
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
