"use client";

import { useCallback, useEffect, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import {
  getMacCompanionStatus,
  importWebAccountVaultItemsToMacCompanion,
} from "../../lib/mac-companion/client";
import { useWebCopy } from "../../lib/i18n/use-web-copy";
import {
  hasSavedPassword,
  normalizeVaultLoginPayload,
  readDraftPassword,
} from "./login-payload";

type MacCompanionPanelProps = {
  accessToken: string | null;
  isUnlocked: boolean;
  items: VaultSyncItem[];
  unlockPassphrase: string | null;
};

type ImportState = "idle" | "importing" | "success" | "error";
type CompanionStatusState =
  | "attention"
  | "checking"
  | "locked"
  | "unavailable"
  | "unlocked";

async function readCompanionStatus(): Promise<CompanionStatusState> {
  const result = await getMacCompanionStatus();

  if (!result.ok) {
    return "unavailable";
  }

  return result.state;
}

export function MacCompanionPanel({
  accessToken,
  isUnlocked,
  items,
  unlockPassphrase,
}: MacCompanionPanelProps) {
  const copy = useWebCopy().vault.macCompanion;
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [companionStatus, setCompanionStatus] =
    useState<CompanionStatusState>("checking");
  const isImporting = importState === "importing";
  const canImport =
    Boolean(accessToken && isUnlocked && unlockPassphrase) &&
    companionStatus === "unlocked" &&
    !isImporting;

  const refreshCompanionStatus = useCallback(async () => {
    const nextStatus = await readCompanionStatus();
    setCompanionStatus(nextStatus);
    return nextStatus;
  }, []);

  useEffect(() => {
    if (!isUnlocked) {
      setImportState("idle");
      setImportMessage(null);
    }
  }, [isUnlocked]);

  useEffect(() => {
    let isActive = true;

    async function refresh() {
      const nextStatus = await readCompanionStatus();

      if (!isActive) {
        return;
      }

      setCompanionStatus(nextStatus);
    }

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function saveToMac() {
    if (!accessToken || !isUnlocked || !unlockPassphrase) {
      setImportState("idle");
      setImportMessage(copy.unlockWebVault);
      return;
    }

    const freshCompanionStatus = await refreshCompanionStatus();

    if (freshCompanionStatus !== "unlocked") {
      setImportState("idle");
      setImportMessage(copy.statusHelper[freshCompanionStatus]);
      return;
    }

    setImportState("importing");
    setImportMessage(copy.savingMessage);

    try {
      const credentials = (
        await Promise.all(
          items
            .filter((item) => hasSavedPassword(item.encrypted_payload))
            .map(async (item) => {
              const payload = normalizeVaultLoginPayload(item.encrypted_payload);
              const password = await readDraftPassword(payload, unlockPassphrase);

              if (!password) {
                return null;
              }

              return {
                id: item.id,
                title: item.title,
                username: payload.username,
                websiteUrl: payload.website_url,
                profileId: "web-account",
                password,
              };
            }),
        )
      ).filter((credential) => credential !== null);

      if (credentials.length === 0) {
        setImportState("idle");
        setImportMessage(copy.emptyMessage);
        return;
      }

      const result = await importWebAccountVaultItemsToMacCompanion({
        accessToken,
        credentials,
      });

      if (result.ok) {
        setImportState("success");
        setImportMessage(copy.formatReceipt(result.credentialCount));
        return;
      }

      setImportState("error");
      if (result.error === "vault_locked") {
        setCompanionStatus("locked");
        setImportMessage(copy.vaultLockedMessage);
        return;
      }

      setImportMessage(copy.importError);
    } catch {
      setImportState("error");
      setCompanionStatus("unavailable");
      setImportMessage(copy.unavailableError);
    }
  }

  const helperText =
    importMessage ??
    (companionStatus === "attention" ||
    companionStatus === "locked" ||
    companionStatus === "unavailable"
      ? copy.statusHelper[companionStatus]
      : isUnlocked
        ? copy.statusHelper[companionStatus]
        : copy.unlockWebVault);
  const statusLabel = copy.statusLabel[companionStatus];
  const helperTextClassName = [
    "vault-helper-text",
    importState === "success" ? "vault-helper-text--success" : "",
    importState === "error" ? "vault-helper-text--error" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const helperTextRole =
    importState === "error"
      ? "alert"
      : importState === "success" || importState === "importing"
        ? "status"
        : undefined;

  return (
    <section
      aria-label={copy.label}
      className="vault-companion-panel"
      data-unu-primitive="state/mac-companion"
    >
      <div className="vault-companion-header">
        <div className="vault-companion-copy">
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="vault-companion-actions">
          <p
            className={`vault-companion-pill vault-companion-pill--${companionStatus}`}
            role="status"
          >
            {statusLabel}
          </p>
          <button
            className="vault-button vault-button--primary vault-companion-import-button"
            type="button"
            disabled={!canImport}
            onClick={() => {
              void saveToMac();
            }}
          >
            {isImporting ? copy.savingButton : copy.saveButton}
          </button>
        </div>
      </div>
      <p
        className={helperTextClassName}
        role={helperTextRole}
      >
        {importState === "success" ? <span aria-hidden="true" /> : null}
        {helperText}
      </p>
    </section>
  );
}
