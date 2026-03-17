export type BootstrapProfileResponse = {
  profile: {
    id: string;
    account_id: string;
    email: string;
    locale: string;
  };
};

type BootstrapErrorResponse = {
  error?: string;
  ok?: boolean;
};

type Fetcher = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok?: boolean;
  status?: number;
  json(): Promise<BootstrapProfileResponse | BootstrapErrorResponse>;
}>;

export async function bootstrapProfile(
  fetcher: Fetcher,
  token: string,
): Promise<BootstrapProfileResponse> {
  const response = await fetcher("/auth/bootstrap", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const payload = (await response.json()) as BootstrapProfileResponse | BootstrapErrorResponse;

  if (response.ok === false) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.error === "string" &&
      payload.error
        ? payload.error
        : `bootstrap_failed:${response.status ?? "unknown"}`;
    throw new Error(message);
  }

  return payload as BootstrapProfileResponse;
}
