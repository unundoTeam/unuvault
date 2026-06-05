"use client";

import { useEffect, useState } from "react";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import { importWebAccountVaultItemsToMacCompanion } from "../../lib/mac-companion/client";
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

function formatImportReceipt(count: number): string {
  return `Saved ${count} ${count === 1 ? "item" : "items"} to this Mac.`;
}

export function MacCompanionPanel({
  accessToken,
  isUnlocked,
  items,
  unlockPassphrase,
}: MacCompanionPanelProps) {
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const isImporting = importState === "importing";
  const canImport = Boolean(accessToken && isUnlocked && unlockPassphrase) && !isImporting;

  useEffect(() => {
    if (!isUnlocked) {
      setImportState("idle");
      setImportMessage(null);
    }
  }, [isUnlocked]);

  async function saveToMac() {
    if (!accessToken || !isUnlocked || !unlockPassphrase) {
      setImportState("idle");
      setImportMessage("Unlock the Web vault before saving to this Mac.");
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
      setImportMessage("Mac companion could not import the vault. Unlock the Mac vault and try again.");
    } catch {
      setImportState("error");
      setImportMessage("Mac companion is not available. Start or unlock the Mac app, then try again.");
    }
  }

  const helperText =
    importMessage ??
    (isUnlocked
      ? "Mac app must be running with its local vault unlocked before import."
      : "Unlock the Web vault before saving to this Mac.");
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
