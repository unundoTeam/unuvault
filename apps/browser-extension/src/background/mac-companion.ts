type CompanionFetcher = typeof fetch;

export type MacCompanionCredentialMetadata = {
  id: string;
  label: string;
  username: string;
};

export type MacCompanionMetadataResult =
  | {
      status: "ready";
      credentials: MacCompanionCredentialMetadata[];
    }
  | {
      status: "locked" | "unavailable";
      credentials: [];
    };

export type MacCompanionReleaseResult =
  | {
      ok: false;
      error: string;
      approval?: {
        id: string;
        origin: string;
        profileId: string;
        label: string;
        username: string;
      };
    }
  | {
      credential: {
        username: string;
        password: string;
      };
    };

type MetadataOptions = {
  accessToken: string;
  origin: string;
  profileId: string;
};

type ReleaseOptions = MetadataOptions & {
  id: string;
  reason: "fill-active-page";
};

type ClaimOptions = MetadataOptions & {
  id: string;
};

export type MacCompanionClient = {
  claimCredentialRelease(options: ClaimOptions): Promise<MacCompanionReleaseResult>;
  readCredentialMetadata(options: MetadataOptions): Promise<MacCompanionMetadataResult>;
  requestCredentialRelease(options: ReleaseOptions): Promise<MacCompanionReleaseResult>;
};

async function readJson<T>(
  response: Awaited<ReturnType<CompanionFetcher>>,
): Promise<T> {
  return (await response.json()) as T;
}

export function createMacCompanionClient(input: {
  baseUrl?: string;
  fetcher?: CompanionFetcher;
} = {}): MacCompanionClient {
  const baseUrl = input.baseUrl ?? "http://127.0.0.1:17666";
  const fetcher = input.fetcher ?? fetch;

  return {
    async claimCredentialRelease(options) {
      try {
        const response = await fetcher(`${baseUrl}/v1/credentials/claim`, {
          body: JSON.stringify({
            id: options.id,
            origin: options.origin,
            profileId: options.profileId,
          }),
          headers: {
            authorization: `Bearer ${options.accessToken}`,
            "content-type": "application/json",
          },
          method: "POST",
        });

        return readJson<MacCompanionReleaseResult>(response);
      } catch {
        return {
          ok: false,
          error: "mac_companion_unavailable",
        };
      }
    },

    async readCredentialMetadata(options) {
      try {
        const url = new URL(`${baseUrl}/v1/credentials`);
        url.searchParams.set("origin", options.origin);
        url.searchParams.set("profileId", options.profileId);

        const response = await fetcher(url.toString(), {
          headers: {
            authorization: `Bearer ${options.accessToken}`,
          },
          method: "GET",
        });

        if (response.status === 423) {
          return {
            status: "locked",
            credentials: [],
          };
        }

        if (!response.ok) {
          return {
            status: "unavailable",
            credentials: [],
          };
        }

        const payload = await readJson<{
          credentials: MacCompanionCredentialMetadata[];
        }>(response);

        return {
          status: "ready",
          credentials: payload.credentials,
        };
      } catch {
        return {
          status: "unavailable",
          credentials: [],
        };
      }
    },

    async requestCredentialRelease(options) {
      try {
        const response = await fetcher(`${baseUrl}/v1/credentials/release`, {
          body: JSON.stringify({
            id: options.id,
            origin: options.origin,
            profileId: options.profileId,
            reason: options.reason,
          }),
          headers: {
            authorization: `Bearer ${options.accessToken}`,
            "content-type": "application/json",
          },
          method: "POST",
        });

        return readJson<MacCompanionReleaseResult>(response);
      } catch {
        return {
          ok: false,
          error: "mac_companion_unavailable",
        };
      }
    },
  };
}
