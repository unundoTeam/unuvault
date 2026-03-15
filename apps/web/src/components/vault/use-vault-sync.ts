"use client";

import { useEffect, useState } from "react";
import type {
  VaultSyncItem,
  VaultSyncRequest,
} from "../../../../../packages/api-client/src/vault";
import { syncVault } from "../../../../../packages/api-client/src/vault";
import { createBrowserSupabaseClient } from "../../lib/supabase-browser";

type VaultSyncState = {
  createItem(title: string): Promise<boolean>;
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<VaultSyncItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runSync(
    token: string,
    payload: VaultSyncRequest,
  ): Promise<boolean> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await syncVault(createApiFetch(), token, payload);
      setItems(response.updated_items);
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    } catch {
      setErrorMessage("We couldn't sync your vault. Please try again.");
      setIsLoading(false);
      return false;
    }
  }

  async function createItem(title: string): Promise<boolean> {
    if (!accessToken) {
      setErrorMessage("Sign in from the register flow first.");
      return false;
    }

    const timestamp = new Date().toISOString();
    const item: VaultSyncItem = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `vault-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      item_type: "login",
      title,
      encrypted_payload: {
        schema_version: 1,
        username: "",
        password_ciphertext: "",
        notes: "",
      },
      favorite: false,
      source: "manual",
      last_used_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    return runSync(accessToken, {
      changed_items: [item],
      deleted_item_ids: [],
    });
  }

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
            setAccessToken(null);
            setIsAuthenticated(false);
            setIsLoading(false);
          }
          return;
        }

        if (!isCancelled) {
          setAccessToken(accessToken);
          void runSync(accessToken, {
            changed_items: [],
            deleted_item_ids: [],
          });
        }
      } catch {
        if (!isCancelled) {
          setItems([]);
          setAccessToken(null);
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
    createItem,
    errorMessage,
    isAuthenticated,
    isLoading,
    items,
  };
}
