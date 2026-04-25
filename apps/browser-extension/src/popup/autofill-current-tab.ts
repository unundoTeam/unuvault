type ContentAutofillResponse =
  | {
      ok: true;
      result: {
        status: string;
        filledPassword?: boolean;
        filledUsername?: boolean;
      };
    }
  | {
      ok: false;
      error: string;
    };
type ContentAutofillSuccessResponse = Extract<
  ContentAutofillResponse,
  { ok: true }
>;

type ExtensionTabs = {
  query?(queryInfo: {
    active: boolean;
    currentWindow: boolean;
  }): Promise<Array<{ id?: number }>>;
  sendMessage?(
    tabId: number,
    message: {
      type: "attempt_autofill_for_current_page";
    },
  ): Promise<ContentAutofillResponse>;
};

function getExtensionTabs(): ExtensionTabs | null {
  return (
    (globalThis as {
      chrome?: {
        tabs?: ExtensionTabs;
      };
    }).chrome?.tabs ?? null
  );
}

export async function requestAutofillCurrentTab(): Promise<ContentAutofillSuccessResponse> {
  const tabs = getExtensionTabs();

  if (!tabs?.query || !tabs.sendMessage) {
    throw new Error("Autofill is not available in this browser.");
  }

  const [activeTab] = await tabs.query({
    active: true,
    currentWindow: true,
  });

  if (typeof activeTab?.id !== "number") {
    throw new Error("No active tab available.");
  }

  const response = await tabs.sendMessage(activeTab.id, {
    type: "attempt_autofill_for_current_page",
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? "We couldn't autofill this page.");
  }

  return response;
}
