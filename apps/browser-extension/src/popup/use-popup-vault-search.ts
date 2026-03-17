import { useEffect, useState } from "react";
import type { VaultSyncItem } from "../../../../packages/api-client/src/vault";
import { normalizeVaultLoginPayload } from "./login-payload";
import { readPopupVaultItems } from "./popup-vault-storage";

type PopupVaultSearchState = {
  filteredItems: VaultSyncItem[];
  hasLoaded: boolean;
  hasStoredItems: boolean;
  searchQuery: string;
  setSearchQuery(value: string): void;
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

export function usePopupVaultSearch(): PopupVaultSearchState {
  const [items, setItems] = useState<VaultSyncItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  return {
    filteredItems: items.filter((item) => matchesSearch(item, searchQuery)),
    hasLoaded,
    hasStoredItems: items.length > 0,
    searchQuery,
    setSearchQuery,
  };
}
