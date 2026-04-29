export type UnubrowserBridgeCredentialMetadata = {
  id: string;
  label: string;
  username: string;
};

export type UnubrowserBridgeReleasedCredential = {
  password: string;
  username: string;
};

export type UnlockedUnubrowserBridgeCredential = {
  id: string;
  label: string;
  password: string;
  profileId?: string;
  username: string;
  websiteOrigin: string;
};

export type UnubrowserBridgeMetadataRequest = {
  origin: string;
  profileId: string;
};

export type UnubrowserBridgeReleaseRequest = UnubrowserBridgeMetadataRequest & {
  id: string;
  reason: string;
};

export type UnubrowserBridgeAuditEvent = {
  id: string;
  origin: string;
  profileId: string;
  reason: "fill-active-page";
  releasedAt: string;
  type: "credential_release";
};

export type UnubrowserBridgeSessionPublishRequest = {
  credentials: UnlockedUnubrowserBridgeCredential[];
};

type UnubrowserBridgeServiceDependencies = {
  clearUnlockedCredentials?(): Promise<void> | void;
  getBrowserAccountIdFromToken?(token: string): Promise<string | null>;
  readUnlockedCredentials(): Promise<UnlockedUnubrowserBridgeCredential[]>;
  replaceUnlockedCredentials?(
    credentials: UnlockedUnubrowserBridgeCredential[],
  ): Promise<void> | void;
  recordBridgeAuditEvent(event: UnubrowserBridgeAuditEvent): Promise<void>;
};

export class UnubrowserBridgeValidationError extends Error {}

export class UnubrowserBridgeCredentialNotFoundError extends Error {}

export class UnubrowserBridgeUnauthorizedError extends Error {}

function normalizeHttpOrigin(origin: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(origin);
  } catch {
    throw new UnubrowserBridgeValidationError("invalid origin");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new UnubrowserBridgeValidationError("unsupported origin");
  }

  return parsedUrl.origin;
}

function validateProfileId(profileId: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId)) {
    throw new UnubrowserBridgeValidationError("invalid profile id");
  }

  return profileId;
}

function validateCredentialId(id: string): string {
  if (
    id.length === 0 ||
    id.length > 200 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id)
  ) {
    throw new UnubrowserBridgeValidationError("invalid credential id");
  }

  return id;
}

function validateReleaseReason(reason: string): "fill-active-page" {
  if (reason !== "fill-active-page") {
    throw new UnubrowserBridgeValidationError("unsupported release reason");
  }

  return reason;
}

function matchesBridgeContext(
  credential: UnlockedUnubrowserBridgeCredential,
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
): asserts value is UnlockedUnubrowserBridgeCredential {
  if (!value || typeof value !== "object") {
    throw new UnubrowserBridgeValidationError("invalid credential");
  }

  const credential = value as Partial<UnlockedUnubrowserBridgeCredential>;

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
    throw new UnubrowserBridgeValidationError("invalid credential");
  }
}

function normalizeUnlockedCredential(
  credential: UnlockedUnubrowserBridgeCredential,
): UnlockedUnubrowserBridgeCredential {
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

type InMemoryUnubrowserBridgeCredentialStoreOptions = {
  now?: () => number;
  ttlMs?: number;
};

export function createInMemoryUnubrowserBridgeCredentialStore(
  options: InMemoryUnubrowserBridgeCredentialStoreOptions = {},
) {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  let credentials: UnlockedUnubrowserBridgeCredential[] = [];
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
      nextCredentials: UnlockedUnubrowserBridgeCredential[],
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

export function createUnubrowserBridgeService(
  deps: UnubrowserBridgeServiceDependencies,
) {
  return {
    async findCredentialMetadata(
      request: UnubrowserBridgeMetadataRequest,
    ): Promise<UnubrowserBridgeCredentialMetadata[]> {
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
      request: UnubrowserBridgeReleaseRequest,
    ): Promise<UnubrowserBridgeReleasedCredential> {
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
        throw new UnubrowserBridgeCredentialNotFoundError("credential not found");
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
      request: UnubrowserBridgeSessionPublishRequest,
    ) {
      const accountId = await deps.getBrowserAccountIdFromToken?.(token);

      if (!accountId) {
        throw new UnubrowserBridgeUnauthorizedError("invalid browser token");
      }

      if (!deps.replaceUnlockedCredentials) {
        throw new UnubrowserBridgeValidationError("bridge session unavailable");
      }

      const credentials = request.credentials.map(normalizeUnlockedCredential);

      await deps.replaceUnlockedCredentials(credentials);

      return {
        ok: true as const,
        credential_count: credentials.length,
      };
    },

    async clearUnlockedCredentialSession(token: string) {
      const accountId = await deps.getBrowserAccountIdFromToken?.(token);

      if (!accountId) {
        throw new UnubrowserBridgeUnauthorizedError("invalid browser token");
      }

      await deps.clearUnlockedCredentials?.();

      return { ok: true as const };
    },
  };
}
