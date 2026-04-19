type SupportedDevSecretTarget = {
  app: string;
  env: string;
  secretKind: "dotenv";
};

const SUPPORTED_DEV_SECRET_TARGETS: readonly SupportedDevSecretTarget[] = [
  {
    app: "unundo",
    env: "local",
    secretKind: "dotenv",
  },
  {
    app: "unundo",
    env: "staging",
    secretKind: "dotenv",
  },
  {
    app: "unundo",
    env: "production",
    secretKind: "dotenv",
  },
  {
    app: "unuidentity",
    env: "local",
    secretKind: "dotenv",
  },
  {
    app: "unuidentity",
    env: "staging",
    secretKind: "dotenv",
  },
  {
    app: "unuidentity",
    env: "production",
    secretKind: "dotenv",
  },
] as const;

export function isSupportedDevSecretProviderTarget(target: {
  app: string;
  env: string;
}) {
  return SUPPORTED_DEV_SECRET_TARGETS.some(
    (candidate) =>
      candidate.app === target.app && candidate.env === target.env,
  );
}

export function isSupportedDevSecretRecordTarget(target: {
  app_code: string;
  target_env: string;
  secret_kind: string;
}) {
  return SUPPORTED_DEV_SECRET_TARGETS.some(
    (candidate) =>
      candidate.app === target.app_code &&
      candidate.env === target.target_env &&
      candidate.secretKind === target.secret_kind,
  );
}

export function listSupportedDevSecretNamespaces() {
  return SUPPORTED_DEV_SECRET_TARGETS.map(
    (target) => `${target.app}/${target.env}/${target.secretKind}`,
  );
}
