export type LocalCredentialBridgeCredentialMetadata = {
  id: string;
  label: string;
  username: string;
};

export type LocalCredentialBridgeReleasedCredential = {
  password: string;
  username: string;
};

export type UnlockedLocalCredentialBridgeCredential = {
  id: string;
  label: string;
  password: string;
  profileId?: string;
  username: string;
  websiteOrigin: string;
};

export type LocalCredentialBridgeMetadataRequest = {
  origin: string;
  profileId: string;
};

export type LocalCredentialBridgeReleaseRequest = LocalCredentialBridgeMetadataRequest & {
  id: string;
  reason: string;
};

export type LocalCredentialBridgeAuditEvent = {
  id: string;
  origin: string;
  profileId: string;
  reason: "fill-active-page";
  releasedAt: string;
  type: "credential_release";
};

export type LocalCredentialBridgeSessionPublishRequest = {
  credentials: UnlockedLocalCredentialBridgeCredential[];
};

type LocalCredentialBridgeServiceDependencies = {
  clearUnlockedCredentials?(): Promise<void> | void;
  getAccountIdFromSessionToken?(token: string): Promise<string | null>;
  readUnlockedCredentials(): Promise<UnlockedLocalCredentialBridgeCredential[]>;
  replaceUnlockedCredentials?(
    credentials: UnlockedLocalCredentialBridgeCredential[],
  ): Promise<void> | void;
  recordBridgeAuditEvent(event: LocalCredentialBridgeAuditEvent): Promise<void>;
};

export class LocalCredentialBridgeValidationError extends Error {}

export class LocalCredentialBridgeCredentialNotFoundError extends Error {}

export class LocalCredentialBridgeUnauthorizedError extends Error {}

function normalizeHttpOrigin(origin: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(origin);
  } catch {
    throw new LocalCredentialBridgeValidationError("invalid origin");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new LocalCredentialBridgeValidationError("unsupported origin");
  }

  return parsedUrl.origin;
}

function validateProfileId(profileId: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId)) {
    throw new LocalCredentialBridgeValidationError("invalid profile id");
  }

  return profileId;
}

function validateCredentialId(id: string): string {
  if (
    id.length === 0 ||
    id.length > 200 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id)
  ) {
    throw new LocalCredentialBridgeValidationError("invalid credential id");
  }

  return id;
}

function validateReleaseReason(reason: string): "fill-active-page" {
  if (reason !== "fill-active-page") {
    throw new LocalCredentialBridgeValidationError("unsupported release reason");
  }

  return reason;
}

function matchesBridgeContext(
  credential: UnlockedLocalCredentialBridgeCredential,
  origin: string,
  profileId: string,
) {
  return (
    credential.websiteOrigin === origin &&
    (!credential.profileId || credential.profileId === profileId)
  );
}

function assertUnlockedCredential(
  value: unknown,
): asserts value is UnlockedLocalCredentialBridgeCredential {
  if (!value || typeof value !== "object") {
    throw new LocalCredentialBridgeValidationError("invalid credential");
  }

  const credential = value as Partial<UnlockedLocalCredentialBridgeCredential>;

  validateCredentialId(credential.id ?? "");
  normalizeHttpOrigin(credential.websiteOrigin ?? "");
  if (credential.profileId) {
    validateProfileId(credential.profileId);
  }

  if (
    typeof credential.label !== "string" ||
    credential.label.trim().length === 0 ||
    typeof credential.username !== "string" ||
    typeof credential.password !== "string" ||
    credential.password.length === 0
  ) {
    throw new LocalCredentialBridgeValidationError("invalid credential");
  }
}

function normalizeUnlockedCredential(
  credential: UnlockedLocalCredentialBridgeCredential,
): UnlockedLocalCredentialBridgeCredential {
  assertUnlockedCredential(credential);

  return {
    id: credential.id,
    label: credential.label,
    password: credential.password,
    profileId: credential.profileId,
    username: credential.username,
    websiteOrigin: normalizeHttpOrigin(credential.websiteOrigin),
  };
}

type InMemoryLocalCredentialBridgeCredentialStoreOptions = {
  now?: () => number;
  ttlMs?: number;
};

export function createInMemoryLocalCredentialBridgeCredentialStore(
  options: InMemoryLocalCredentialBridgeCredentialStoreOptions = {},
) {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  let credentials: UnlockedLocalCredentialBridgeCredential[] = [];
  let expiresAt = 0;

  return {
    async readUnlockedCredentials() {
      if (now() >= expiresAt) {
        credentials = [];
        return [];
      }

      return credentials;
    },

    async replaceUnlockedCredentials(
      nextCredentials: UnlockedLocalCredentialBridgeCredential[],
    ) {
      credentials = nextCredentials.map(normalizeUnlockedCredential);
      expiresAt = now() + ttlMs;
    },

    async clearUnlockedCredentials() {
      credentials = [];
      expiresAt = 0;
    },
  };
}

export function createLocalCredentialBridgeService(
  deps: LocalCredentialBridgeServiceDependencies,
) {
  return {
    async findCredentialMetadata(
      request: LocalCredentialBridgeMetadataRequest,
    ): Promise<LocalCredentialBridgeCredentialMetadata[]> {
      const origin = normalizeHttpOrigin(request.origin);
      const profileId = validateProfileId(request.profileId);
      const credentials = await deps.readUnlockedCredentials();

      return credentials
        .filter((credential) =>
          matchesBridgeContext(credential, origin, profileId),
        )
        .map((credential) => ({
          id: credential.id,
          label: credential.label,
          username: credential.username,
        }));
    },

    async releaseSecret(
      request: LocalCredentialBridgeReleaseRequest,
    ): Promise<LocalCredentialBridgeReleasedCredential> {
      const id = validateCredentialId(request.id);
      const origin = normalizeHttpOrigin(request.origin);
      const profileId = validateProfileId(request.profileId);
      const reason = validateReleaseReason(request.reason);
      const credentials = await deps.readUnlockedCredentials();
      const credential = credentials.find(
        (candidate) =>
          candidate.id === id &&
          matchesBridgeContext(candidate, origin, profileId),
      );

      if (!credential) {
        throw new LocalCredentialBridgeCredentialNotFoundError(
          "credential not found",
        );
      }

      await deps.recordBridgeAuditEvent({
        id,
        origin,
        profileId,
        reason,
        releasedAt: new Date().toISOString(),
        type: "credential_release",
      });

      return {
        password: credential.password,
        username: credential.username,
      };
    },

    async publishUnlockedCredentialSession(
      token: string,
      request: LocalCredentialBridgeSessionPublishRequest,
    ) {
      const accountId = await deps.getAccountIdFromSessionToken?.(token);

      if (!accountId) {
        throw new LocalCredentialBridgeUnauthorizedError("invalid session token");
      }

      if (!deps.replaceUnlockedCredentials) {
        throw new LocalCredentialBridgeValidationError(
          "bridge session unavailable",
        );
      }

      const credentials = request.credentials.map(normalizeUnlockedCredential);

      await deps.replaceUnlockedCredentials(credentials);

      return {
        ok: true as const,
        credential_count: credentials.length,
      };
    },

    async clearUnlockedCredentialSession(token: string) {
      const accountId = await deps.getAccountIdFromSessionToken?.(token);

      if (!accountId) {
        throw new LocalCredentialBridgeUnauthorizedError("invalid session token");
      }

      await deps.clearUnlockedCredentials?.();

      return { ok: true as const };
    },
  };
}
