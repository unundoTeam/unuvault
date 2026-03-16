export type BootstrapProfileResponse = {
  profile: {
    id: string;
    account_id: string;
    email: string;
    locale: string;
  };
};

type Fetcher = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  json(): Promise<BootstrapProfileResponse>;
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

  return response.json();
}
