import type { MasterPasswordVerifier } from "../../../../packages/security/src/master-password-verifier";

const MASTER_PASSWORD_VERIFIER_STORAGE_KEY =
  "unuvault.extension.master-password-verifier";

type ExtensionStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function getExtensionStorageArea(): ExtensionStorageArea | null {
  return (
    (globalThis as {
      chrome?: {
        storage?: {
          local?: ExtensionStorageArea;
        };
      };
    }).chrome?.storage?.local ?? null
  );
}

function isMasterPasswordVerifier(
  value: unknown,
): value is MasterPasswordVerifier {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<MasterPasswordVerifier>).version === 1 &&
    typeof (value as Partial<MasterPasswordVerifier>).salt === "string" &&
    typeof (value as Partial<MasterPasswordVerifier>).check === "string"
  );
}

export async function readMasterPasswordVerifier(): Promise<MasterPasswordVerifier | null> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return null;
  }

  try {
    const stored = await storage.get(MASTER_PASSWORD_VERIFIER_STORAGE_KEY);
    const rawValue = stored[MASTER_PASSWORD_VERIFIER_STORAGE_KEY];

    if (typeof rawValue !== "string") {
      return isMasterPasswordVerifier(rawValue) ? rawValue : null;
    }

    const parsed = JSON.parse(rawValue) as unknown;

    return isMasterPasswordVerifier(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeMasterPasswordVerifier(
  verifier: MasterPasswordVerifier,
): Promise<void> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return;
  }

  await storage.set({
    [MASTER_PASSWORD_VERIFIER_STORAGE_KEY]: JSON.stringify(verifier),
  });
}

export async function clearMasterPasswordVerifier(): Promise<void> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return;
  }

  await storage.remove(MASTER_PASSWORD_VERIFIER_STORAGE_KEY);
}
