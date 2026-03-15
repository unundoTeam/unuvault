"use client";

import { useEffect, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import { syncVault } from "../../../../../packages/api-client/src/vault";
import { createBrowserSupabaseClient } from "../../lib/supabase-browser";

type VaultSyncState = {
  errorMessage: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  items: VaultSyncItem[];
};

function createApiFetch() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  return (input: string, init?: RequestInit) => fetch(`${baseUrl}${input}`, init);
}

export function useVaultSync(): VaultSyncState {
  const [items, setItems] = useState<VaultSyncItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadVault() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createBrowserSupabaseClient();
        const result = await supabase.auth.getSession();

        if (result.error) {
          throw result.error;
        }

        const accessToken = result.data.session?.access_token ?? null;

        if (!accessToken) {
          if (!isCancelled) {
            setItems([]);
            setIsAuthenticated(false);
            setIsLoading(false);
          }
          return;
        }

        const payload = await syncVault(createApiFetch(), accessToken, {
          changed_items: [],
          deleted_item_ids: [],
        });

        if (!isCancelled) {
          setItems(payload.updated_items);
          setIsAuthenticated(true);
          setIsLoading(false);
        }
      } catch {
        if (!isCancelled) {
          setItems([]);
          setIsAuthenticated(false);
          setErrorMessage("We couldn't sync your vault. Please try again.");
          setIsLoading(false);
        }
      }
    }

    void loadVault();

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    errorMessage,
    isAuthenticated,
    isLoading,
    items,
  };
}
