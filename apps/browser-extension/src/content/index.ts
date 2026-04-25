import { attemptAutofillForCurrentPage } from "./autofill";

type ContentAutofillRequest = {
  type?: string;
};

type ContentAutofillResponse =
  | {
      ok: true;
      result: Awaited<ReturnType<typeof attemptAutofillForCurrentPage>>;
    }
  | {
      ok: false;
      error: string;
    };

type ContentMessageListener = (
  request: ContentAutofillRequest,
  sender: unknown,
  sendResponse: (response: ContentAutofillResponse) => void,
) => boolean | void;

type ExtensionRuntime = {
  onMessage?: {
    addListener(listener: ContentMessageListener): void;
  };
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

function isAutofillRequest(request: ContentAutofillRequest) {
  return request.type === "attempt_autofill_for_current_page";
}

export function createContentAutofillMessageListener(input: {
  document: Document;
  pageUrl: string;
}): ContentMessageListener {
  return (request, _sender, sendResponse) => {
    if (!isAutofillRequest(request)) {
      return false;
    }

    void attemptAutofillForCurrentPage(input)
      .then((result) => {
        sendResponse({
          ok: true,
          result,
        });
      })
      .catch(() => {
        sendResponse({
          ok: false,
          error: "We couldn't autofill this page.",
        });
      });

    return true;
  };
}

export function registerContentAutofillTrigger(
  runtime: ExtensionRuntime | null = getExtensionRuntime(),
) {
  if (!runtime?.onMessage?.addListener) {
    return false;
  }

  runtime.onMessage.addListener(
    createContentAutofillMessageListener({
      document,
      pageUrl: window.location.href,
    }),
  );

  return true;
}

registerContentAutofillTrigger();
