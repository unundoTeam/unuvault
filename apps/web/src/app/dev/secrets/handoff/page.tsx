"use client";

import { useEffect, useState } from "react";
import { createIdentityBrowserClient } from "../../../../lib/identity/browser";
import { startBrowserHandoff } from "../../../../lib/dev-secrets/browser-handoff";

type SearchParams = {
  callback?: string;
  state?: string;
  app?: string;
  env?: string;
};

function buildRegisterHref(searchParams: SearchParams) {
  const nextPath = new URLSearchParams();

  if (searchParams.callback) {
    nextPath.set("callback", searchParams.callback);
  }

  if (searchParams.state) {
    nextPath.set("state", searchParams.state);
  }

  if (searchParams.app) {
    nextPath.set("app", searchParams.app);
  }

  if (searchParams.env) {
    nextPath.set("env", searchParams.env);
  }

  return `/register?next=${encodeURIComponent(
    `/dev/secrets/handoff?${nextPath.toString()}`,
  )}`;
}

export default function DevSecretsHandoffPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const callbackUrl = searchParams.callback ?? "";
  const state = searchParams.state ?? "";
  const app = searchParams.app ?? "unundo";
  const env = searchParams.env ?? "local";
  const [status, setStatus] = useState<
    "working" | "requires_auth" | "redirecting" | "error"
  >(
    callbackUrl && state ? "working" : "error",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    callbackUrl && state
      ? null
      : "Missing callback details for the local CLI handoff.",
  );

  useEffect(() => {
    if (!callbackUrl || !state) {
      return;
    }

    let isCancelled = false;

    async function runBrowserHandoff() {
      const result = await startBrowserHandoff({
        identity: createIdentityBrowserClient(),
        fetcher: fetch,
        callbackUrl,
        state,
        app,
        env,
        redirect(url: string) {
          window.location.assign(url);
        },
      });

      if (isCancelled) {
        return;
      }

      if (result.status === "requires_auth") {
        setStatus("requires_auth");
        return;
      }

      if (result.status === "error") {
        setStatus("error");
        setErrorMessage(result.message);
        return;
      }

      setStatus("redirecting");
    }

    void runBrowserHandoff();

    return () => {
      isCancelled = true;
    };
  }, [app, callbackUrl, env, state]);

  return (
    <main>
      <h1>Connect your terminal</h1>
      <p>
        Keep this tab open while unuvault connects your browser session to the
        local CLI.
      </p>

      {status === "working" || status === "redirecting" ? (
        <p aria-live="polite">Preparing the local handoff...</p>
      ) : null}

      {status === "requires_auth" ? (
        <>
          <p aria-live="polite">
            Sign in first so this browser can mint a one-time handoff code.
          </p>
          <a href={buildRegisterHref(searchParams)}>Continue through register</a>
        </>
      ) : null}

      {status === "error" && errorMessage ? (
        <p aria-live="polite">{errorMessage}</p>
      ) : null}
    </main>
  );
}
