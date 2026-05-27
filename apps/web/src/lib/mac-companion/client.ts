type CompanionFetcher = typeof fetch;

export type MacCompanionStatus = {
  ok: true;
  state: "locked" | "unlocked" | "attention";
};

export type MacCompanionApprovalRequest = {
  id: string;
  origin: string;
  profileId: string;
  label: string;
  username: string;
};

type RequestReleaseOptions = {
  accessToken: string;
  fetcher?: CompanionFetcher;
  id: string;
  origin: string;
  profileId: string;
};

type StatusOptions = {
  fetcher?: CompanionFetcher;
};

type MacCompanionUnavailable = {
  ok: false;
  error: string;
};

type MacCompanionReleaseResult =
  | {
      ok: false;
      error: string;
      approval?: MacCompanionApprovalRequest;
    }
  | {
      credential: {
        username: string;
        password: string;
      };
    };

async function readJson<T>(
  response: Awaited<ReturnType<CompanionFetcher>>,
): Promise<T> {
  return (await response.json()) as T;
}

export async function getMacCompanionStatus(
  options: StatusOptions = {},
): Promise<MacCompanionStatus | MacCompanionUnavailable> {
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher("http://127.0.0.1:17666/status", {
      method: "GET",
    });

    return readJson<MacCompanionStatus | MacCompanionUnavailable>(response);
  } catch {
    return { ok: false, error: "mac_companion_unavailable" };
  }
}

export async function requestMacCompanionCredentialRelease(
  options: RequestReleaseOptions,
): Promise<MacCompanionReleaseResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("http://127.0.0.1:17666/v1/credentials/release", {
    body: JSON.stringify({
      id: options.id,
      origin: options.origin,
      profileId: options.profileId,
      reason: "fill-active-page",
    }),
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  return readJson<MacCompanionReleaseResult>(response);
}
