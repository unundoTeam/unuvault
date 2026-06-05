"use client";

import { useCallback, useEffect, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import {
  getMacCompanionStatus,
  importWebAccountVaultItemsToMacCompanion,
} from "../../lib/mac-companion/client";
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

function formatImportReceipt(count: number): string {
  return `Saved ${count} ${count === 1 ? "item" : "items"} to this Mac.`;
}

function companionStatusLabel(status: CompanionStatusState): string {
  switch (status) {
    case "attention":
      return "Mac companion attention";
    case "checking":
      return "Checking Mac companion";
    case "locked":
      return "Mac companion locked";
    case "unavailable":
      return "Mac companion unavailable";
    case "unlocked":
      return "Mac companion unlocked";
  }
}

function companionStatusHelper(status: CompanionStatusState): string {
  switch (status) {
    case "attention":
      return "Review the Mac app before saving Web items locally.";
    case "checking":
      return "Checking whether the Mac app is running and unlocked.";
    case "locked":
      return "Unlock the Mac vault before saving Web items locally.";
    case "unavailable":
      return "Open the Mac app on this Mac, then unlock its local vault.";
    case "unlocked":
      return "Mac companion is ready. Saved items stay encrypted on this Mac.";
  }
}

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
      setImportMessage("Unlock the Web vault before saving to this Mac.");
      return;
    }

    const freshCompanionStatus = await refreshCompanionStatus();

    if (freshCompanionStatus !== "unlocked") {
      setImportState("idle");
      setImportMessage(companionStatusHelper(freshCompanionStatus));
      return;
    }

    setImportState("importing");
    setImportMessage("Saving unlocked vault items to this Mac...");

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
        setImportMessage("No saved passwords are available to send to this Mac.");
        return;
      }

      const result = await importWebAccountVaultItemsToMacCompanion({
        accessToken,
        credentials,
      });

      if (result.ok) {
        setImportState("success");
        setImportMessage(formatImportReceipt(result.credentialCount));
        return;
      }

      setImportState("error");
      if (result.error === "vault_locked") {
        setCompanionStatus("locked");
        setImportMessage("Unlock the Mac vault before saving Web items locally.");
        return;
      }

      setImportMessage(
        "Mac companion could not import the vault. Unlock the Mac vault and try again.",
      );
    } catch {
      setImportState("error");
      setCompanionStatus("unavailable");
      setImportMessage("Mac companion is not available. Start or unlock the Mac app, then try again.");
    }
  }

  const helperText =
    importMessage ??
    (companionStatus === "attention" ||
    companionStatus === "locked" ||
    companionStatus === "unavailable"
      ? companionStatusHelper(companionStatus)
      : isUnlocked
        ? companionStatusHelper(companionStatus)
        : "Unlock the Web vault before saving to this Mac.");
  const statusLabel = companionStatusLabel(companionStatus);
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
      aria-label="Mac companion"
      className="vault-companion-panel"
      data-unu-primitive="state/mac-companion"
    >
      <div className="vault-companion-header">
        <div className="vault-companion-copy">
          <h2>Save to this Mac</h2>
          <p>
            Send unlocked vault items to the trusted Mac companion. The Mac vault
            must be running and unlocked.
          </p>
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
            {isImporting ? "Saving..." : "Save to this Mac"}
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
