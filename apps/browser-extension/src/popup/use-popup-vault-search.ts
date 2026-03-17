import { useEffect, useState } from "react";
import type { VaultSyncItem } from "../../../../packages/api-client/src/vault";
import { normalizeVaultLoginPayload, readStoredPassword } from "./login-payload";
import { readPopupVaultItems } from "./popup-vault-storage";

type PopupVaultSearchOptions = {
  isUnlocked: boolean;
  unlockPassphrase: string | null;
};

type PopupVaultSearchState = {
  copiedPasswordItemId: string | null;
  copiedUsernameItemId: string | null;
  copyPassword(itemId: string, encryptedPayload: unknown): Promise<void>;
  copyUsername(itemId: string, username: string): Promise<void>;
  filteredItems: VaultSyncItem[];
  hasLoaded: boolean;
  hasStoredItems: boolean;
  isPasswordRevealed(itemId: string): boolean;
  searchQuery: string;
  setSearchQuery(value: string): void;
  togglePasswordVisibility(itemId: string): void;
};

function sortVaultItems(items: VaultSyncItem[]): VaultSyncItem[] {
  return [...items].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

function matchesSearch(item: VaultSyncItem, searchQuery: string): boolean {
  if (!searchQuery) {
    return true;
  }

  const payload = normalizeVaultLoginPayload(item.encrypted_payload);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [item.title, payload.username, payload.notes].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

export function usePopupVaultSearch({
  isUnlocked,
  unlockPassphrase,
}: PopupVaultSearchOptions): PopupVaultSearchState {
  const [items, setItems] = useState<VaultSyncItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedUsernameItemId, setCopiedUsernameItemId] = useState<string | null>(null);
  const [copiedPasswordItemId, setCopiedPasswordItemId] = useState<string | null>(null);
  const [revealedPasswordItemIds, setRevealedPasswordItemIds] = useState<string[]>([]);

  useEffect(() => {
    let isActive = true;

    void readPopupVaultItems().then((storedItems) => {
      if (!isActive) {
        return;
      }

      setItems(sortVaultItems(storedItems));
      setHasLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      return;
    }

    setCopiedUsernameItemId(null);
    setCopiedPasswordItemId(null);
    setRevealedPasswordItemIds([]);
  }, [isUnlocked]);

  async function copyUsername(itemId: string, username: string) {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      return;
    }

    await navigator.clipboard.writeText(username);
    setCopiedUsernameItemId(itemId);
  }

  async function copyPassword(itemId: string, encryptedPayload: unknown) {
    if (!isUnlocked) {
      return;
    }

    const password = readStoredPassword(encryptedPayload, unlockPassphrase ?? undefined);

    if (
      !password ||
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      return;
    }

    await navigator.clipboard.writeText(password);
    setCopiedPasswordItemId(itemId);
  }

  function togglePasswordVisibility(itemId: string) {
    if (!isUnlocked) {
      return;
    }

    setRevealedPasswordItemIds((current) =>
      current.includes(itemId)
        ? current.filter((currentItemId) => currentItemId !== itemId)
        : [...current, itemId],
    );
  }

  return {
    copiedPasswordItemId,
    copiedUsernameItemId,
    copyPassword,
    copyUsername,
    filteredItems: items.filter((item) => matchesSearch(item, searchQuery)),
    hasLoaded,
    hasStoredItems: items.length > 0,
    isPasswordRevealed(itemId: string) {
      return revealedPasswordItemIds.includes(itemId);
    },
    searchQuery,
    setSearchQuery,
    togglePasswordVisibility,
  };
}
