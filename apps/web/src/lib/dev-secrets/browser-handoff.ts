"use client";

import { createDevSecretsHandoff } from "../../../../../packages/api-client/src/dev-secrets";
import { createBrowserApiFetch } from "../api/browser-fetch";

type IdentityClientLike = {
  auth: {
    getSession(): Promise<{
      data?: {
        session?: {
          access_token?: string | null;
        } | null;
      };
      error?: unknown | null;
    }>;
  };
};

type BrowserHandoffOptions = {
  identity: IdentityClientLike;
  fetcher: typeof fetch;
  callbackUrl: string;
  state: string;
  app: string;
  env: string;
  redirect(url: string): void;
};

type BrowserHandoffResult =
  | { status: "redirecting" }
  | { status: "requires_auth" }
  | { status: "error"; message: string };

export async function startBrowserHandoff(
  options: BrowserHandoffOptions,
): Promise<BrowserHandoffResult> {
  try {
    const sessionResult = await options.identity.auth.getSession();
    const accessToken = sessionResult.data?.session?.access_token ?? null;

    if (!accessToken) {
      return { status: "requires_auth" };
    }

    const response = await createDevSecretsHandoff(createBrowserApiFetch(options.fetcher), accessToken, {
      app: options.app,
      env: options.env,
    });
    const redirectUrl = new URL(options.callbackUrl);

    redirectUrl.searchParams.set("code", response.handoff_code);
    redirectUrl.searchParams.set("state", options.state);
    options.redirect(redirectUrl.toString());

    return { status: "redirecting" };
  } catch {
    return {
      status: "error",
      message: "We couldn't connect this browser session to your local CLI.",
    };
  }
}
