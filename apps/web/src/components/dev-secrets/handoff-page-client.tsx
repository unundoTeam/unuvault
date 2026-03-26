"use client";

import { useEffect, useState } from "react";
import { createIdentityBrowserClient } from "../../lib/identity/browser";
import { startBrowserHandoff } from "../../lib/dev-secrets/browser-handoff";

type DevSecretsHandoffPageClientProps = {
  callbackUrl: string;
  state: string;
  app: string;
  env: string;
};

function buildRegisterHref({
  callbackUrl,
  state,
  app,
  env,
}: DevSecretsHandoffPageClientProps) {
  const nextPath = new URLSearchParams();

  if (callbackUrl) {
    nextPath.set("callback", callbackUrl);
  }

  if (state) {
    nextPath.set("state", state);
  }

  if (app) {
    nextPath.set("app", app);
  }

  if (env) {
    nextPath.set("env", env);
  }

  return `/register?next=${encodeURIComponent(
    `/dev/secrets/handoff?${nextPath.toString()}`,
  )}`;
}

export function DevSecretsHandoffPageClient({
  callbackUrl,
  state,
  app,
  env,
}: DevSecretsHandoffPageClientProps) {
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
          <a
            href={buildRegisterHref({
              callbackUrl,
              state,
              app,
              env,
            })}
          >
            Continue through register
          </a>
        </>
      ) : null}

      {status === "error" && errorMessage ? (
        <p aria-live="polite">{errorMessage}</p>
      ) : null}
    </main>
  );
}
