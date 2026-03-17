const AUTH_STORAGE_KEY = "unuvault.extension.auth-state";

export type StoredAuthState = {
  accessToken: string;
  email: string;
  profileId: string;
  signedInAt: string;
};

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

function isStoredAuthState(value: unknown): value is StoredAuthState {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Partial<StoredAuthState>).accessToken === "string" &&
    typeof (value as Partial<StoredAuthState>).email === "string" &&
    typeof (value as Partial<StoredAuthState>).profileId === "string" &&
    typeof (value as Partial<StoredAuthState>).signedInAt === "string"
  );
}

export async function readStoredAuthState(): Promise<StoredAuthState | null> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return null;
  }

  try {
    const stored = await storage.get(AUTH_STORAGE_KEY);
    const rawValue = stored[AUTH_STORAGE_KEY];
    const parsed = typeof rawValue === "string" ? (JSON.parse(rawValue) as unknown) : rawValue;

    return isStoredAuthState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeStoredAuthState(state: StoredAuthState): Promise<void> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return;
  }

  await storage.set({
    [AUTH_STORAGE_KEY]: JSON.stringify(state),
  });
}

export async function clearStoredAuthState(): Promise<void> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return;
  }

  await storage.remove(AUTH_STORAGE_KEY);
}
