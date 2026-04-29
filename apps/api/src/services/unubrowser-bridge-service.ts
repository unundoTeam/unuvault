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
  profileId: string;
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

type UnubrowserBridgeServiceDependencies = {
  readUnlockedCredentials(): Promise<UnlockedUnubrowserBridgeCredential[]>;
  recordBridgeAuditEvent(event: UnubrowserBridgeAuditEvent): Promise<void>;
};

export class UnubrowserBridgeValidationError extends Error {}

export class UnubrowserBridgeCredentialNotFoundError extends Error {}

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
  if (!/^vault-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
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
  return credential.websiteOrigin === origin && credential.profileId === profileId;
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
  };
}

export function createConfiguredUnubrowserBridgeService() {
  return createUnubrowserBridgeService({
    async readUnlockedCredentials() {
      return [];
    },
    async recordBridgeAuditEvent(event) {
      console.info(
        `[unubrowser-bridge] ${event.type} id=${event.id} origin=${event.origin} profileId=${event.profileId} reason=${event.reason} releasedAt=${event.releasedAt}`,
      );
    },
  });
}
