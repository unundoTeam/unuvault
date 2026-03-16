interface CallbackResult {
  error: { message?: string } | null;
}

interface CompleteIdentityCallbackDependencies {
  exchangeCodeForSession(code: string): Promise<CallbackResult>;
}

function resolveSafeNextPath(next: string | null) {
  if (!next) {
    return "/auth/finalize";
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/auth/finalize";
  }

  return next;
}

export async function completeIdentityCallback(
  requestUrl: string,
  { exchangeCodeForSession }: CompleteIdentityCallbackDependencies,
) {
  const url = new URL(requestUrl);
  const code = url.searchParams.get("code");

  if (!code) {
    return "/register";
  }

  const { error } = await exchangeCodeForSession(code);

  if (error) {
    return "/register?authError=callback_failed";
  }

  return resolveSafeNextPath(url.searchParams.get("next"));
}
