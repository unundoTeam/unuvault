export function getSingleSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveSafeAuthNextPath(nextPath?: string | null) {
  if (!nextPath) {
    return "/auth/finalize";
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/auth/finalize";
  }

  return nextPath;
}

export function buildAuthCallbackUrl(nextPath?: string | null) {
  const redirect = new URL("/auth/callback", window.location.origin);
  redirect.searchParams.set("next", resolveSafeAuthNextPath(nextPath));
  return redirect.toString();
}

export function buildLoginHref(
  nextPath?: string | null,
  provider?: "google",
) {
  const params = new URLSearchParams();
  params.set("next", resolveSafeAuthNextPath(nextPath));

  if (provider) {
    params.set("provider", provider);
  }

  return `/login?${params.toString()}`;
}

export function buildRegisterHref(nextPath?: string | null) {
  const params = new URLSearchParams();
  params.set("next", resolveSafeAuthNextPath(nextPath));
  return `/register?${params.toString()}`;
}
