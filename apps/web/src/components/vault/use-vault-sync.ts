"use client";

import { useEffect, useState } from "react";
import type {
  VaultSyncItem,
  VaultSyncRequest,
} from "../../../../../packages/api-client/src/vault";
import { syncVault } from "../../../../../packages/api-client/src/vault";
import { createBrowserSupabaseClient } from "../../lib/supabase-browser";
import { normalizeVaultLoginPayload } from "./login-payload";

type VaultSyncAction = "load" | "create" | "update" | "delete";
type VaultLoginFields = {
  title: string;
  username: string;
  notes: string;
};

type VaultSyncState = {
  createItem(input: VaultLoginFields): Promise<boolean>;
  deleteItem(itemId: string): Promise<boolean>;
  errorMessage: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  items: VaultSyncItem[];
  lastAction: VaultSyncAction | null;
  lastSyncedAt: string | null;
  updateItem(itemId: string, input: VaultLoginFields): Promise<boolean>;
};

function createApiFetch() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  return (input: string, init?: RequestInit) => fetch(`${baseUrl}${input}`, init);
}

export function useVaultSync(): VaultSyncState {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<VaultSyncItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<VaultSyncAction | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  async function runSync(
    token: string,
    payload: VaultSyncRequest,
    action: VaultSyncAction,
  ): Promise<boolean> {
    setIsLoading(true);
    setIsSyncing(true);
    setLastAction(action);
    setErrorMessage(null);

    try {
      const response = await syncVault(createApiFetch(), token, payload);
      setItems(response.updated_items);
      setIsAuthenticated(true);
      setLastAction(action);
      setLastSyncedAt(response.server_time);
      setIsLoading(false);
      setIsSyncing(false);
      return true;
    } catch {
      setErrorMessage("We couldn't sync your vault. Please try again.");
      setIsLoading(false);
      setIsSyncing(false);
      return false;
    }
  }

  async function createItem(input: VaultLoginFields): Promise<boolean> {
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
      title: input.title,
      encrypted_payload: {
        schema_version: 1,
        username: input.username,
        password_ciphertext: "",
        notes: input.notes,
      },
      favorite: false,
      source: "manual",
      last_used_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    return runSync(
      accessToken,
      {
        changed_items: [item],
        deleted_item_ids: [],
      },
      "create",
    );
  }

  async function deleteItem(itemId: string): Promise<boolean> {
    if (!accessToken) {
      setErrorMessage("Sign in from the register flow first.");
      return false;
    }

    return runSync(
      accessToken,
      {
        changed_items: [],
        deleted_item_ids: [itemId],
      },
      "delete",
    );
  }

  async function updateItem(itemId: string, input: VaultLoginFields): Promise<boolean> {
    if (!accessToken) {
      setErrorMessage("Sign in from the register flow first.");
      return false;
    }

    const currentItem = items.find((item) => item.id === itemId);

    if (!currentItem) {
      setErrorMessage("We couldn't find that vault item.");
      return false;
    }

    return runSync(
      accessToken,
      {
        changed_items: [
          {
            ...currentItem,
            title: input.title,
            encrypted_payload: {
              ...normalizeVaultLoginPayload(currentItem.encrypted_payload),
              username: input.username,
              notes: input.notes,
            },
          updated_at: new Date().toISOString(),
        },
      ],
        deleted_item_ids: [],
      },
      "update",
    );
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadVault() {
      setIsLoading(true);
      setIsBootstrapping(true);
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
            setIsBootstrapping(false);
            setIsLoading(false);
          }
          return;
        }

        if (!isCancelled) {
          setAccessToken(accessToken);
          const didSync = await runSync(
            accessToken,
            {
              changed_items: [],
              deleted_item_ids: [],
            },
            "load",
          );

          if (!isCancelled && !didSync) {
            setIsAuthenticated(false);
          }

          if (!isCancelled) {
            setIsBootstrapping(false);
          }
        }
      } catch {
        if (!isCancelled) {
          setItems([]);
          setAccessToken(null);
          setIsAuthenticated(false);
          setErrorMessage("We couldn't sync your vault. Please try again.");
          setIsBootstrapping(false);
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
    deleteItem,
    errorMessage,
    isAuthenticated,
    isBootstrapping,
    isLoading,
    isSyncing,
    items,
    lastAction,
    lastSyncedAt,
    updateItem,
  };
}
