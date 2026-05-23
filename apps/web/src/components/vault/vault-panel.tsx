"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  getHiddenPasswordPlaceholder,
  hasSavedPassword,
  normalizeVaultLoginPayload,
  normalizeVaultWebsiteUrl,
  readDraftPassword,
} from "./login-payload";
import { useVaultSync } from "./use-vault-sync";
import { useVaultUnlock } from "./use-vault-unlock";
import {
  clearLocalCredentialBridgeSession,
  publishLocalCredentialBridgeSession,
} from "../../lib/local-credential-bridge/bridge-session";

function formatUtcSyncTime(timestamp: string): string {
  const value = new Date(timestamp);
  const hours = value.getUTCHours().toString().padStart(2, "0");
  const minutes = value.getUTCMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes} UTC`;
}

function getVaultItemInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "VA";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function VaultPanel() {
  const {
    accessToken,
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
  const [draftWebsite, setDraftWebsite] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [copiedUsernameItemId, setCopiedUsernameItemId] = useState<string | null>(null);
  const [copiedPasswordItemId, setCopiedPasswordItemId] = useState<string | null>(null);
  const [revealedPasswordItemIds, setRevealedPasswordItemIds] = useState<string[]>([]);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingUsername, setEditingUsername] = useState("");
  const [editingWebsite, setEditingWebsite] = useState("");
  const [editingPassword, setEditingPassword] = useState("");
  const [editingNotes, setEditingNotes] = useState("");
  const [isEditingPasswordVisible, setIsEditingPasswordVisible] = useState(false);
  const [editingValidationMessage, setEditingValidationMessage] = useState<string | null>(
    null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = draftTitle.trim();
    const nextWebsiteUrl = normalizeVaultWebsiteUrl(draftWebsite);

    if (!nextTitle) {
      setValidationMessage("Title is required.");
      return;
    }

    if (draftWebsite.trim() && !nextWebsiteUrl) {
      setValidationMessage("Enter a valid website URL.");
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
      websiteUrl: nextWebsiteUrl,
      unlockPassphrase: unlockPassphrase ?? undefined,
    });

    if (didCreate) {
      setDraftTitle("");
      setDraftUsername("");
      setDraftWebsite("");
      setDraftPassword("");
      setDraftNotes("");
      setIsCreatePasswordVisible(false);
    }
  }

  async function startEditing(item: (typeof items)[number]) {
    const payload = normalizeVaultLoginPayload(item.encrypted_payload);
    const openedPassword = unlockPassphrase
      ? await readDraftPassword(item.encrypted_payload, unlockPassphrase)
      : "";

    setEditingItemId(item.id);
    setEditingTitle(item.title);
    setEditingUsername(payload.username);
    setEditingWebsite(payload.website_url);
    setEditingPassword(openedPassword);
    setEditingNotes(payload.notes);
    setIsEditingPasswordVisible(false);
    setEditingValidationMessage(null);
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditingTitle("");
    setEditingUsername("");
    setEditingWebsite("");
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

  async function copyPassword(itemId: string, payload: unknown) {
    if (!isUnlocked || !unlockPassphrase) {
      return;
    }

    const password = await readDraftPassword(payload, unlockPassphrase);

    if (!password) {
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

  async function togglePasswordVisibility(itemId: string, payload: unknown) {
    if (!isUnlocked || !unlockPassphrase) {
      return;
    }

    if (revealedPasswordItemIds.includes(itemId)) {
      setRevealedPasswordItemIds((current) =>
        current.filter((currentItemId) => currentItemId !== itemId),
      );
      setRevealedPasswords((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      return;
    }

    const password = await readDraftPassword(payload, unlockPassphrase);

    if (!password) {
      return;
    }

    setRevealedPasswords((current) => ({ ...current, [itemId]: password }));
    setRevealedPasswordItemIds((current) => [...current, itemId]);
  }

  async function saveEditing() {
    if (!editingItemId) {
      return;
    }

    const nextTitle = editingTitle.trim();
    const nextWebsiteUrl = normalizeVaultWebsiteUrl(editingWebsite);

    if (!nextTitle) {
      setEditingValidationMessage("Edited title is required.");
      return;
    }

    if (editingWebsite.trim() && !nextWebsiteUrl) {
      setEditingValidationMessage("Enter a valid website URL.");
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
      websiteUrl: nextWebsiteUrl,
      unlockPassphrase: unlockPassphrase ?? undefined,
    });

    if (didSave) {
      cancelEditing();
    }
  }

  useEffect(() => {
    if (!isUnlocked) {
      setRevealedPasswordItemIds([]);
      setRevealedPasswords({});
    }
  }, [isUnlocked]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    if (!isUnlocked || !unlockPassphrase) {
      void clearLocalCredentialBridgeSession({ accessToken }).catch(() => undefined);
      return;
    }

    void publishLocalCredentialBridgeSession({
      accessToken,
      items,
      unlockPassphrase,
    }).catch(() => undefined);
  }, [accessToken, isUnlocked, items, unlockPassphrase]);

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

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleItems = normalizedSearchQuery
    ? items.filter((item) => {
        const payload = normalizeVaultLoginPayload(item.encrypted_payload);

        return [item.title, payload.username, payload.website_url]
          .filter((value) => value.trim().length > 0)
          .some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery));
      })
    : items;

  return (
    <section
      aria-labelledby="vault-heading"
      className="vault-shell"
      data-unu-primitive="vault-surface"
    >
      <div className="vault-header">
        <div className="vault-title-group">
          <h1 id="vault-heading">Vault</h1>
          <p>Keep your current unuvault items in sync across every trusted surface.</p>
        </div>

        <div className="vault-header-meta">
          {statusMessage ? (
            <p
              className="vault-status-pill"
              data-unu-primitive="state/status"
              role="status"
            >
              {statusMessage}
            </p>
          ) : null}
          {lastSyncedAt ? (
            <p className="vault-sync-time">
              Last synced at {formatUtcSyncTime(lastSyncedAt)}
            </p>
          ) : null}
        </div>
      </div>
      {!isBootstrapping && !isAuthenticated ? (
        <p className="vault-auth-note">Sign in from the register flow first.</p>
      ) : null}
      {errorMessage ? (
        <p className="vault-alert" data-unu-primitive="state/error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!isBootstrapping && isAuthenticated ? (
        <div className="vault-workspace">
          <aside className="vault-panel vault-panel--unlock">
            <div className="vault-panel-copy">
              <h2>Master password</h2>
              <p>
                Unlock before saving or revealing a password. The bridge session is
                published only while unlocked.
              </p>
            </div>
            <form
              aria-label="Unlock vault"
              className="vault-form vault-form--unlock"
              data-unu-primitive="form/unlock"
              onSubmit={(event) => {
                event.preventDefault();
                void submitUnlock();
              }}
            >
              <label className="vault-field">
                <span className="vault-label">Master password</span>
                <input
                  className="vault-input"
                  name="master-password"
                  type="password"
                  value={draftPassphrase}
                  onChange={(event) => setDraftPassphrase(event.target.value)}
                />
              </label>
              {mode === "needs_setup" ? (
                <label className="vault-field">
                  <span className="vault-label">Confirm master password</span>
                  <input
                    className="vault-input"
                    name="confirm-master-password"
                    type="password"
                    value={draftConfirmPassphrase}
                    onChange={(event) => setDraftConfirmPassphrase(event.target.value)}
                  />
                </label>
              ) : null}
              {isUnlocked ? (
                <button
                  className="vault-button vault-button--primary"
                  type="button"
                  onClick={lock}
                >
                  Lock vault
                </button>
              ) : (
                <button className="vault-button vault-button--primary" type="submit">
                  {submitLabel}
                </button>
              )}
              {isUnlocked ? <p className="vault-safe-pill">Vault unlocked</p> : null}
              {unlockError ? <p className="vault-alert">{unlockError}</p> : null}
            </form>

            <div className="vault-card vault-card--create">
              <h2>Save a login</h2>
              <form
                aria-label="Save vault item"
                className="vault-form vault-form--create"
                data-unu-primitive="form/save-item"
                onSubmit={handleSubmit}
              >
                <label className="vault-field">
                  <span className="vault-label">Title</span>
                  <input
                    className="vault-input"
                    name="title"
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                  />
                </label>
                <label className="vault-field">
                  <span className="vault-label">Username</span>
                  <input
                    className="vault-input"
                    name="username"
                    type="text"
                    value={draftUsername}
                    onChange={(event) => {
                      setDraftUsername(event.target.value);
                      setValidationMessage(null);
                    }}
                  />
                </label>
                <label className="vault-field">
                  <span className="vault-label">Website</span>
                  <input
                    className="vault-input"
                    name="website"
                    type="text"
                    value={draftWebsite}
                    onChange={(event) => {
                      setDraftWebsite(event.target.value);
                      setValidationMessage(null);
                    }}
                  />
                </label>
                <label className="vault-field">
                  <span className="vault-label">Password</span>
                  <input
                    className="vault-input"
                    name="password"
                    type={isCreatePasswordVisible ? "text" : "password"}
                    value={draftPassword}
                    onChange={(event) => {
                      setDraftPassword(event.target.value);
                      setValidationMessage(null);
                    }}
                    disabled={!isUnlocked}
                  />
                </label>
                <button
                  className="vault-button vault-button--secondary"
                  type="button"
                  onClick={() => setIsCreatePasswordVisible((current) => !current)}
                  disabled={isSyncing || !isUnlocked}
                >
                  {isCreatePasswordVisible ? "Hide password" : "Show password"}
                </button>
                <label className="vault-field">
                  <span className="vault-label">Notes</span>
                  <textarea
                    className="vault-input vault-textarea"
                    name="notes"
                    value={draftNotes}
                    onChange={(event) => {
                      setDraftNotes(event.target.value);
                      setValidationMessage(null);
                    }}
                  />
                </label>
                <button
                  className="vault-button vault-button--dark"
                  type="submit"
                  disabled={isSyncing}
                >
                  Save item
                </button>
              </form>

              {validationMessage ? (
                <p
                  className="vault-alert"
                  data-unu-primitive="state/validation-error"
                  role="alert"
                >
                  {validationMessage}
                </p>
              ) : null}
            </div>
          </aside>

          <section
            aria-labelledby="vault-items-heading"
            className="vault-panel vault-panel--items"
          >
            <div className="vault-items-header">
              <div>
                <h2 id="vault-items-heading">Vault items</h2>
                <p>Passwords stay hidden until the vault is unlocked.</p>
              </div>
              <label className="vault-search-field">
                <span className="vault-visually-hidden">Search vault</span>
                <input
                  className="vault-input"
                  placeholder="Search vault"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
            </div>

            <p className="vault-review-banner">
              <span className="vault-review-label">Review state</span>: copy, show,
              edit, and delete are explicit actions; destructive delete remains
              visually separate.
            </p>

            {visibleItems.length > 0 ? (
              <ul className="vault-items-list" data-unu-primitive="list/vault-items">
                {visibleItems.map((item) => (
                  <li
                    className="vault-item-row"
                    data-unu-primitive="row/vault-item"
                    key={item.id}
                  >
                    {(() => {
                      const payload = normalizeVaultLoginPayload(item.encrypted_payload);
                      const isPasswordRevealed = revealedPasswordItemIds.includes(item.id);
                      const hasPassword = hasSavedPassword(item.encrypted_payload);
                      const passwordDisplayText = isPasswordRevealed
                        ? revealedPasswords[item.id] ??
                          getHiddenPasswordPlaceholder(item.encrypted_payload)
                        : getHiddenPasswordPlaceholder(item.encrypted_payload);

                      return editingItemId === item.id ? (
                        <div className="vault-edit-grid">
                          <label className="vault-field">
                            <span className="vault-label">Edit title</span>
                            <input
                              className="vault-input"
                              name={`edit-title-${item.id}`}
                              type="text"
                              value={editingTitle}
                              onChange={(event) => {
                                setEditingTitle(event.target.value);
                                setEditingValidationMessage(null);
                              }}
                            />
                          </label>
                          <label className="vault-field">
                            <span className="vault-label">Edit username</span>
                            <input
                              className="vault-input"
                              name={`edit-username-${item.id}`}
                              type="text"
                              value={editingUsername}
                              onChange={(event) => {
                                setEditingUsername(event.target.value);
                                setEditingValidationMessage(null);
                              }}
                            />
                          </label>
                          <label className="vault-field">
                            <span className="vault-label">Edit website</span>
                            <input
                              className="vault-input"
                              name={`edit-website-${item.id}`}
                              type="text"
                              value={editingWebsite}
                              onChange={(event) => {
                                setEditingWebsite(event.target.value);
                                setEditingValidationMessage(null);
                              }}
                            />
                          </label>
                          <label className="vault-field">
                            <span className="vault-label">Edit password</span>
                            <input
                              className="vault-input"
                              name={`edit-password-${item.id}`}
                              type={isEditingPasswordVisible ? "text" : "password"}
                              value={editingPassword}
                              onChange={(event) => setEditingPassword(event.target.value)}
                              disabled={!isUnlocked}
                            />
                          </label>
                          <button
                            className="vault-button vault-button--secondary"
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
                          <label className="vault-field">
                            <span className="vault-label">Edit notes</span>
                            <textarea
                              className="vault-input vault-textarea"
                              name={`edit-notes-${item.id}`}
                              value={editingNotes}
                              onChange={(event) => {
                                setEditingNotes(event.target.value);
                                setEditingValidationMessage(null);
                              }}
                            />
                          </label>
                          <div className="vault-row-actions">
                            <button
                              className="vault-button vault-button--primary"
                              type="button"
                              onClick={() => void saveEditing()}
                              disabled={isSyncing}
                            >
                              Save
                            </button>
                            <button
                              className="vault-button vault-button--secondary"
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSyncing}
                            >
                              Cancel
                            </button>
                          </div>
                          {editingValidationMessage ? (
                            <p className="vault-alert">{editingValidationMessage}</p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div className="vault-item-main">
                            <span className="vault-item-avatar" aria-hidden="true">
                              {getVaultItemInitials(item.title)}
                            </span>
                            <span className="vault-item-copy">
                              <span className="vault-item-title">{item.title}</span>
                              <span className="vault-item-meta">
                                {payload.username.trim() ? (
                                  <span className="vault-item-meta-part">
                                    {payload.username}
                                  </span>
                                ) : null}
                                {payload.notes.trim() ? (
                                  <span className="vault-item-meta-part">Notes added</span>
                                ) : null}
                                <span className="vault-item-meta-part">
                                  {passwordDisplayText}
                                </span>
                              </span>
                            </span>
                          </div>
                          <div className="vault-row-actions">
                            {payload.username.trim() ? (
                              <button
                                className="vault-button vault-button--soft"
                                aria-label={
                                  copiedUsernameItemId === item.id
                                    ? `Copied ${item.title}`
                                    : `Copy username ${item.title}`
                                }
                                type="button"
                                onClick={() => void copyUsername(item.id, payload.username)}
                                disabled={isSyncing}
                              >
                                {copiedUsernameItemId === item.id
                                  ? "Copied"
                                  : "Copy username"}
                              </button>
                            ) : null}
                            {hasPassword ? (
                              <button
                                className="vault-button vault-button--safe"
                                aria-label={
                                  copiedPasswordItemId === item.id
                                    ? `Copied password ${item.title}`
                                    : `Copy password ${item.title}`
                                }
                                type="button"
                                onClick={() =>
                                  void copyPassword(item.id, item.encrypted_payload)
                                }
                                disabled={isSyncing || !isUnlocked}
                              >
                                {copiedPasswordItemId === item.id
                                  ? "Copied password"
                                  : "Copy password"}
                              </button>
                            ) : null}
                            {hasPassword ? (
                              <button
                                className="vault-button vault-button--secondary"
                                aria-label={
                                  isPasswordRevealed
                                    ? `Hide password ${item.title}`
                                    : `Show password ${item.title}`
                                }
                                type="button"
                                onClick={() =>
                                  void togglePasswordVisibility(
                                    item.id,
                                    item.encrypted_payload,
                                  )
                                }
                                disabled={isSyncing || !isUnlocked}
                              >
                                {isPasswordRevealed ? "Hide" : "Show"}
                              </button>
                            ) : null}
                            <button
                              className="vault-button vault-button--secondary"
                              aria-label={`Edit ${item.title}`}
                              type="button"
                              onClick={() => void startEditing(item)}
                              disabled={isSyncing}
                            >
                              Edit
                            </button>
                            <button
                              className="vault-button vault-button--danger vault-action-danger"
                              aria-label={`Delete ${item.title}`}
                              type="button"
                              onClick={() => void deleteItem(item.id)}
                              disabled={isSyncing}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vault-empty-state">
                {items.length > 0 ? "No matching vault items." : "No vault items yet."}
              </p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
