"use client";

import { useEffect, useState } from "react";
import type {
  VaultSyncItem,
  VaultSyncRequest,
} from "../../../../../packages/api-client/src/vault";
import { syncVault } from "../../../../../packages/api-client/src/vault";
import { createIdentityBrowserClient } from "../../lib/identity/browser";
import { createBrowserApiFetch } from "../../lib/api/browser-fetch";
import {
  normalizeVaultLoginPayload,
  normalizeVaultWebsiteUrl,
  writeDraftPassword,
} from "./login-payload";

type VaultSyncAction = "load" | "create" | "update" | "delete";
type VaultLoginFields = {
  title: string;
  username: string;
  password?: string;
  notes: string;
  websiteUrl: string;
  unlockPassphrase?: string;
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

function isProfileNotReadyError(error: unknown): boolean {
  return error instanceof Error && error.message === "profile_not_found";
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
      const response = await syncVault(createBrowserApiFetch(), token, payload);
      setItems(response.updated_items);
      setIsAuthenticated(true);
      setLastAction(action);
      setLastSyncedAt(response.server_time);
      setIsLoading(false);
      setIsSyncing(false);
      return true;
    } catch (error) {
      setErrorMessage(null);
      if (!isProfileNotReadyError(error)) {
        setErrorMessage("We couldn't sync your vault. Please try again.");
      }
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
      encrypted_payload: writeDraftPassword(
        {
          schema_version: 1,
          username: input.username,
          password_ciphertext: "",
          notes: input.notes,
          website_url: normalizeVaultWebsiteUrl(input.websiteUrl),
        },
        input.password ?? "",
        input.unlockPassphrase,
      ),
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

    const currentPayload = normalizeVaultLoginPayload(currentItem.encrypted_payload);
    const nextPayload =
      input.password === undefined
        ? {
            ...currentPayload,
            username: input.username,
            notes: input.notes,
            website_url: normalizeVaultWebsiteUrl(input.websiteUrl),
          }
        : writeDraftPassword(
            {
              ...currentPayload,
              username: input.username,
              notes: input.notes,
              website_url: normalizeVaultWebsiteUrl(input.websiteUrl),
            },
            input.password,
            input.unlockPassphrase,
          );

    return runSync(
      accessToken,
      {
        changed_items: [
          {
            ...currentItem,
            title: input.title,
            encrypted_payload: nextPayload,
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
        const identity = createIdentityBrowserClient();
        const result = await identity.auth.getSession();

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
      } catch (error) {
        if (!isCancelled) {
          setItems([]);
          setAccessToken(null);
          setIsAuthenticated(false);
          setErrorMessage(null);
          if (!isProfileNotReadyError(error)) {
            setErrorMessage("We couldn't sync your vault. Please try again.");
          }
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
