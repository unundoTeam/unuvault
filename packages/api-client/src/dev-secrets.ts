export type DevSecretTarget = {
  app: string;
  env: string;
};

export type DevSecretsHandoffResponse = {
  handoff_code: string;
};

export type DevSecretsExchangeResponse = {
  cli_session_token: string;
};

export type DevSecretRecordResponse = {
  ciphertext: string;
};

export type DevSecretWriteResponse = {
  ok: true;
};

type ErrorResponse = {
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
  json(): Promise<unknown>;
}>;

function readErrorMessage(payload: unknown): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error
  ) {
    return payload.error;
  }

  return null;
}

async function readJsonResponse<T>(
  response: Awaited<ReturnType<Fetcher>>,
  fallbackErrorCode: string,
): Promise<T> {
  const payload = (await response.json()) as T | ErrorResponse;

  if (response.ok === false) {
    const message =
      readErrorMessage(payload) ??
      `${fallbackErrorCode}:${response.status ?? "unknown"}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function createDevSecretsHandoff(
  fetcher: Fetcher,
  token: string,
  target: DevSecretTarget,
): Promise<DevSecretsHandoffResponse> {
  const response = await fetcher("/dev/secrets/handoffs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(target),
  });

  return readJsonResponse<DevSecretsHandoffResponse>(
    response,
    "handoff_create_failed",
  );
}

export async function exchangeDevSecretsHandoff(
  fetcher: Fetcher,
  handoffCode: string,
): Promise<DevSecretsExchangeResponse> {
  const response = await fetcher("/dev/secrets/handoffs/exchange", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      handoff_code: handoffCode,
    }),
  });

  return readJsonResponse<DevSecretsExchangeResponse>(
    response,
    "handoff_exchange_failed",
  );
}

export async function readDevSecretRecord(
  fetcher: Fetcher,
  token: string,
  target: DevSecretTarget,
): Promise<DevSecretRecordResponse> {
  const response = await fetcher(
    `/dev/secrets/records/${target.app}/${target.env}/dotenv`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );

  return readJsonResponse<DevSecretRecordResponse>(
    response,
    "secret_read_failed",
  );
}

export async function writeDevSecretRecord(
  fetcher: Fetcher,
  token: string,
  target: DevSecretTarget & { ciphertext: string },
): Promise<DevSecretWriteResponse> {
  const response = await fetcher(
    `/dev/secrets/records/${target.app}/${target.env}/dotenv`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ciphertext: target.ciphertext,
      }),
    },
  );

  return readJsonResponse<DevSecretWriteResponse>(
    response,
    "secret_write_failed",
  );
}
