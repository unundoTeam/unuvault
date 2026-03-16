"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  getPasswordPlaceholderLabel,
  hasSavedPassword,
  normalizeVaultLoginPayload,
  readDraftPassword,
} from "./login-payload";
import { useVaultSync } from "./use-vault-sync";
import { useVaultUnlock } from "./use-vault-unlock";

function formatUtcSyncTime(timestamp: string): string {
  const value = new Date(timestamp);
  const hours = value.getUTCHours().toString().padStart(2, "0");
  const minutes = value.getUTCMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes} UTC`;
}

export function VaultPanel() {
  const {
    createItem,
    deleteItem,
    errorMessage,
    isAuthenticated,
    isBootstrapping,
    isSyncing,
    items,
    lastAction,
    lastSyncedAt,
    updateItem,
  } = useVaultSync();
  const {
    draftConfirmPassphrase,
    draftPassphrase,
    isUnlocked,
    lock,
    mode,
    submitUnlock,
    setDraftConfirmPassphrase,
    setDraftPassphrase,
    submitLabel,
    unlockPassphrase,
    unlockError,
  } = useVaultUnlock(items);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUsername, setDraftUsername] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [copiedUsernameItemId, setCopiedUsernameItemId] = useState<string | null>(null);
  const [copiedPasswordItemId, setCopiedPasswordItemId] = useState<string | null>(null);
  const [revealedPasswordItemIds, setRevealedPasswordItemIds] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingUsername, setEditingUsername] = useState("");
  const [editingPassword, setEditingPassword] = useState("");
  const [editingNotes, setEditingNotes] = useState("");
  const [isEditingPasswordVisible, setIsEditingPasswordVisible] = useState(false);
  const [editingValidationMessage, setEditingValidationMessage] = useState<string | null>(
    null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = draftTitle.trim();

    if (!nextTitle) {
      setValidationMessage("Title is required.");
      return;
    }

    if (draftPassword && !isUnlocked) {
      setValidationMessage("Unlock the vault before saving a password.");
      return;
    }

    setValidationMessage(null);

    const didCreate = await createItem({
      title: nextTitle,
      username: draftUsername,
      password: draftPassword,
      notes: draftNotes,
      unlockPassphrase: unlockPassphrase ?? undefined,
    });

    if (didCreate) {
      setDraftTitle("");
      setDraftUsername("");
      setDraftPassword("");
      setDraftNotes("");
      setIsCreatePasswordVisible(false);
    }
  }

  function startEditing(item: (typeof items)[number]) {
    const payload = normalizeVaultLoginPayload(item.encrypted_payload);

    setEditingItemId(item.id);
    setEditingTitle(item.title);
    setEditingUsername(payload.username);
    setEditingPassword(readDraftPassword(item.encrypted_payload, unlockPassphrase ?? undefined));
    setEditingNotes(payload.notes);
    setIsEditingPasswordVisible(false);
    setEditingValidationMessage(null);
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditingTitle("");
    setEditingUsername("");
    setEditingPassword("");
    setEditingNotes("");
    setIsEditingPasswordVisible(false);
    setEditingValidationMessage(null);
  }

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

    window.setTimeout(() => {
      setCopiedUsernameItemId((current) => (current === itemId ? null : current));
    }, 1500);
  }

  async function copyPassword(itemId: string, password: string) {
    if (!isUnlocked || !password) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      return;
    }

    await navigator.clipboard.writeText(password);
    setCopiedPasswordItemId(itemId);

    window.setTimeout(() => {
      setCopiedPasswordItemId((current) => (current === itemId ? null : current));
    }, 1500);
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

  async function saveEditing() {
    if (!editingItemId) {
      return;
    }

    const nextTitle = editingTitle.trim();

    if (!nextTitle) {
      setEditingValidationMessage("Edited title is required.");
      return;
    }

    if (editingPassword && !isUnlocked) {
      setEditingValidationMessage("Unlock the vault before saving a password.");
      return;
    }

    setEditingValidationMessage(null);

    const didSave = await updateItem(editingItemId, {
      title: nextTitle,
      username: editingUsername,
      password: isUnlocked ? editingPassword : undefined,
      notes: editingNotes,
      unlockPassphrase: unlockPassphrase ?? undefined,
    });

    if (didSave) {
      cancelEditing();
    }
  }

  const statusMessage = errorMessage
    ? null
    : isBootstrapping
      ? "Syncing vault..."
      : isSyncing && lastAction === "create"
        ? "Saving item..."
        : isSyncing && lastAction === "update"
          ? "Updating item..."
          : isSyncing && lastAction === "delete"
            ? "Deleting item..."
            : lastAction === "load"
              ? "Vault synced"
              : lastAction === "create"
                ? "Item saved"
                : lastAction === "update"
                  ? "Item updated"
                  : lastAction === "delete"
                    ? "Item deleted"
                    : null;

  return (
    <section>
      <h1>Vault</h1>
      <p>Keep your current unuvault items in sync across every trusted surface.</p>

      {statusMessage ? <p>{statusMessage}</p> : null}
      {lastSyncedAt ? <p>Last synced at {formatUtcSyncTime(lastSyncedAt)}</p> : null}
      {!isBootstrapping && !isAuthenticated ? (
        <p>Sign in from the register flow first.</p>
      ) : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {!isBootstrapping && isAuthenticated ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitUnlock();
          }}
        >
          <label>
            <span>Master password</span>
            <input
              name="master-password"
              type="password"
              value={draftPassphrase}
              onChange={(event) => setDraftPassphrase(event.target.value)}
            />
          </label>
          {mode === "needs_setup" ? (
            <label>
              <span>Confirm master password</span>
              <input
                name="confirm-master-password"
                type="password"
                value={draftConfirmPassphrase}
                onChange={(event) => setDraftConfirmPassphrase(event.target.value)}
              />
            </label>
          ) : null}
          {isUnlocked ? (
            <button type="button" onClick={lock}>
              Lock vault
            </button>
          ) : (
            <button type="submit">{submitLabel}</button>
          )}
          {isUnlocked ? <p>Vault unlocked</p> : null}
          {unlockError ? <p>{unlockError}</p> : null}
        </form>
      ) : null}

      {!isBootstrapping && isAuthenticated ? (
        <>
          <form onSubmit={handleSubmit}>
            <label>
              <span>Title</span>
              <input
                name="title"
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </label>
            <label>
              <span>Username</span>
              <input
                name="username"
                type="text"
                value={draftUsername}
                onChange={(event) => setDraftUsername(event.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type={isCreatePasswordVisible ? "text" : "password"}
                value={draftPassword}
                onChange={(event) => setDraftPassword(event.target.value)}
                disabled={!isUnlocked}
              />
            </label>
            <button
              type="button"
              onClick={() => setIsCreatePasswordVisible((current) => !current)}
              disabled={isSyncing || !isUnlocked}
            >
              {isCreatePasswordVisible ? "Hide password" : "Show password"}
            </button>
            <label>
              <span>Notes</span>
              <textarea
                name="notes"
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
              />
            </label>
            <button type="submit" disabled={isSyncing}>
              Save item
            </button>
          </form>

          {validationMessage ? <p>{validationMessage}</p> : null}

          {items.length > 0 ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  {(() => {
                    const payload = normalizeVaultLoginPayload(item.encrypted_payload);
                    const isPasswordRevealed = revealedPasswordItemIds.includes(item.id);
                    const hasPassword = hasSavedPassword(item.encrypted_payload);

                    return editingItemId === item.id ? (
                      <>
                        <label>
                          <span>Edit title</span>
                          <input
                            name={`edit-title-${item.id}`}
                            type="text"
                            value={editingTitle}
                            onChange={(event) => {
                              setEditingTitle(event.target.value);
                              setEditingValidationMessage(null);
                            }}
                          />
                        </label>
                        <label>
                          <span>Edit username</span>
                          <input
                            name={`edit-username-${item.id}`}
                            type="text"
                            value={editingUsername}
                            onChange={(event) => setEditingUsername(event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Edit password</span>
                          <input
                            name={`edit-password-${item.id}`}
                            type={isEditingPasswordVisible ? "text" : "password"}
                            value={editingPassword}
                            onChange={(event) => setEditingPassword(event.target.value)}
                            disabled={!isUnlocked}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setIsEditingPasswordVisible((current) => !current)
                          }
                          disabled={isSyncing || !isUnlocked}
                        >
                          {isEditingPasswordVisible
                            ? "Hide edit password"
                            : "Show edit password"}
                        </button>
                        <label>
                          <span>Edit notes</span>
                          <textarea
                            name={`edit-notes-${item.id}`}
                            value={editingNotes}
                            onChange={(event) => setEditingNotes(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void saveEditing()}
                          disabled={isSyncing}
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEditing} disabled={isSyncing}>
                          Cancel
                        </button>
                        {editingValidationMessage ? <p>{editingValidationMessage}</p> : null}
                      </>
                    ) : (
                      <>
                        <span>{item.title}</span>
                        {payload.username ? <span>{payload.username}</span> : null}
                        {payload.notes.trim() ? <span>Notes added</span> : null}
                        <span>
                          {getPasswordPlaceholderLabel(
                            item.encrypted_payload,
                            isPasswordRevealed,
                            unlockPassphrase ?? undefined,
                          )}
                        </span>
                        {payload.username.trim() ? (
                          <button
                            type="button"
                            onClick={() => void copyUsername(item.id, payload.username)}
                            disabled={isSyncing}
                          >
                            {copiedUsernameItemId === item.id
                              ? `Copied ${item.title}`
                              : `Copy username ${item.title}`}
                          </button>
                        ) : null}
                        {hasPassword ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyPassword(
                                item.id,
                                readDraftPassword(
                                  item.encrypted_payload,
                                  unlockPassphrase ?? undefined,
                                ),
                              )
                            }
                            disabled={isSyncing || !isUnlocked}
                          >
                            {copiedPasswordItemId === item.id
                              ? `Copied password ${item.title}`
                              : `Copy password ${item.title}`}
                          </button>
                        ) : null}
                        {hasPassword ? (
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(item.id)}
                            disabled={isSyncing || !isUnlocked}
                          >
                            {isPasswordRevealed
                              ? `Hide password ${item.title}`
                              : `Show password ${item.title}`}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          disabled={isSyncing}
                        >
                          Edit {item.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteItem(item.id)}
                          disabled={isSyncing}
                        >
                          Delete {item.title}
                        </button>
                      </>
                    );
                  })()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No vault items yet.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
