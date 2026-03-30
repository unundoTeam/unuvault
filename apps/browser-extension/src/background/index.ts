import type { BackgroundRequest, BackgroundResponse } from "./protocol";
import {
  handleBackgroundRequest,
  type BackgroundCallerContext,
  type BackgroundRuntimeDeps,
} from "./runtime";

type MessageSender = {
  tab?: {
    url?: string | null;
  } | null;
  url?: string;
};

type MessageListener = (
  request: BackgroundRequest,
  sender: MessageSender,
  sendResponse: (response: BackgroundResponse) => void,
) => boolean;

type ExtensionRuntime = {
  id?: string;
  onMessage?: {
    addListener(listener: MessageListener): void;
  };
};

type BackgroundMessageBridgeOptions = {
  deps?: BackgroundRuntimeDeps;
  extensionOrigin?: string | null;
  handleRequest?: typeof handleBackgroundRequest;
  runtime?: ExtensionRuntime | null;
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

function readExtensionOrigin(runtime: ExtensionRuntime | null) {
  return runtime?.id ? `chrome-extension://${runtime.id}/` : null;
}

export function createCallerContextFromSender(
  sender: MessageSender,
  extensionOrigin: string | null,
): BackgroundCallerContext {
  if (sender.tab?.url) {
    return {
      source: "content",
      trustedPageUrl: sender.tab.url,
    };
  }

  if (extensionOrigin && sender.url?.startsWith(extensionOrigin)) {
    return {
      source: "popup",
      trustedPageUrl: null,
    };
  }

  return {
    source: "internal",
    trustedPageUrl: null,
  };
}

export function createBackgroundMessageListener(
  options: Omit<BackgroundMessageBridgeOptions, "runtime"> = {},
): MessageListener {
  const handleRequest = options.handleRequest ?? handleBackgroundRequest;

  return (request, sender, sendResponse) => {
    const callerContext = createCallerContextFromSender(
      sender,
      options.extensionOrigin ?? null,
    );

    void handleRequest(request, options.deps, callerContext)
      .then(sendResponse)
      .catch(() => {
        sendResponse({
          ok: false,
          error: "We couldn't complete that request. Please try again.",
        });
      });

    return true;
  };
}

export function registerBackgroundMessageBridge(
  options: BackgroundMessageBridgeOptions = {},
) {
  const runtime = options.runtime ?? getExtensionRuntime();

  if (!runtime?.onMessage?.addListener) {
    return false;
  }

  runtime.onMessage.addListener(
    createBackgroundMessageListener({
      deps: options.deps,
      extensionOrigin: options.extensionOrigin ?? readExtensionOrigin(runtime),
      handleRequest: options.handleRequest,
    }),
  );

  return true;
}

registerBackgroundMessageBridge();
