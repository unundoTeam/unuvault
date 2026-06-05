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
import { MacCompanionPanel } from "./mac-companion-panel";

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"item" | "create">("item");

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
      setDetailMode("item");
    }
  }

  async function startEditing(item: (typeof items)[number]) {
    const payload = normalizeVaultLoginPayload(item.encrypted_payload);
    const openedPassword = unlockPassphrase
      ? await readDraftPassword(item.encrypted_payload, unlockPassphrase)
      : "";

    setSelectedItemId(item.id);
    setDetailMode("item");
    setEditingItemId(item.id);
    setEditingTitle(item.title);
    setEditingUsername(payload.username);
    setEditingWebsite(payload.website_url);
    setEditingPassword(openedPassword);
    setEditingNotes(payload.notes);
    setIsEditingPasswordVisible(false);
    setEditingValidationMessage(null);
  }

  function openCreatePanel() {
    if (!isUnlocked) {
      return;
    }

    cancelEditing();
    setDetailMode("create");
  }

  function selectItem(itemId: string) {
    if (!isUnlocked) {
      return;
    }

    cancelEditing();
    setSelectedItemId(itemId);
    setDetailMode("item");
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
      setSelectedItemId(null);
      setDetailMode("item");
      cancelEditing();
    }
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    if (items.length === 0) {
      setSelectedItemId(null);
      setDetailMode("create");
      return;
    }

    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0]?.id ?? null);
      setDetailMode("item");
    }
  }, [isUnlocked, items, selectedItemId]);

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
  const selectedItem =
    isUnlocked && detailMode === "item"
      ? items.find((item) => item.id === selectedItemId) ?? items[0] ?? null
      : null;
  const selectedPayload = selectedItem
    ? normalizeVaultLoginPayload(selectedItem.encrypted_payload)
    : null;
  const selectedHasPassword = selectedItem
    ? hasSavedPassword(selectedItem.encrypted_payload)
    : false;
  const isSelectedPasswordRevealed = selectedItem
    ? revealedPasswordItemIds.includes(selectedItem.id)
    : false;
  const selectedPasswordDisplayText =
    selectedItem && isSelectedPasswordRevealed
      ? revealedPasswords[selectedItem.id] ??
        getHiddenPasswordPlaceholder(selectedItem.encrypted_payload)
      : selectedItem
        ? getHiddenPasswordPlaceholder(selectedItem.encrypted_payload)
        : "";

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
        <div
          className={`vault-workspace ${
            isUnlocked ? "vault-workspace--unlocked" : "vault-workspace--locked"
          }`}
        >
          <aside className="vault-panel vault-panel--unlock">
            <div className="vault-panel-copy">
              <h2>
                {isUnlocked
                  ? "Unlocked session"
                  : mode === "needs_setup"
                    ? "Create master password"
                    : "Unlock vault"}
              </h2>
              <p>
                {isUnlocked
                  ? "Sensitive fields and row actions are available until you lock again."
                  : "Use your master password to reveal saved credentials and enable row actions."}
              </p>
            </div>
            {isUnlocked ? (
              <div className="vault-session-actions">
                <p className="vault-safe-pill" role="status">
                  Vault unlocked
                </p>
                <button
                  className="vault-button vault-button--secondary"
                  type="button"
                  onClick={lock}
                >
                  Lock vault
                </button>
              </div>
            ) : (
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
                <button className="vault-button vault-button--primary" type="submit">
                  {submitLabel}
                </button>
                {unlockError ? <p className="vault-alert">{unlockError}</p> : null}
              </form>
            )}
          </aside>

          <section
            aria-labelledby="vault-items-heading"
            className="vault-panel vault-panel--items"
          >
            <div className="vault-items-header">
              <div>
                <h2 id="vault-items-heading">Vault items</h2>
                <p>
                  {isUnlocked
                    ? "Search, copy, edit, and save actions are available."
                    : "Passwords stay hidden until the vault is unlocked."}
                </p>
              </div>
              <div className="vault-toolbar">
                <label className="vault-search-field">
                  <span className="vault-visually-hidden">Search vault</span>
                  <input
                    className="vault-input"
                    disabled={!isUnlocked}
                    placeholder={isUnlocked ? "Search vault" : "Unlock to search"}
                    type="search"
                    value={isUnlocked ? searchQuery : ""}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
                {isUnlocked ? (
                  <button
                    className="vault-button vault-button--primary vault-new-login-button"
                    type="button"
                    onClick={openCreatePanel}
                  >
                    New login
                  </button>
                ) : null}
              </div>
            </div>

            <p className="vault-review-banner" role="note">
              <span className="vault-review-label">
                {isUnlocked ? "Unlocked session" : "Locked state"}
              </span>
              :{" "}
              {isUnlocked
                ? "Secure green is state feedback only; danger red is reserved for destructive actions."
                : "Save, copy, reveal, edit, and delete remain unavailable while locked."}
            </p>

            <MacCompanionPanel
              accessToken={accessToken}
              isUnlocked={isUnlocked}
              items={items}
              unlockPassphrase={unlockPassphrase}
            />

            {visibleItems.length > 0 ? (
              <ul className="vault-items-list" data-unu-primitive="list/vault-items">
                {visibleItems.map((item) => (
                  <li
                    className={`vault-item-row ${
                      selectedItem?.id === item.id ? "vault-item-row--selected" : ""
                    }`}
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

                      return (
                        <>
                          <div className="vault-item-main">
                            <span className="vault-item-avatar" aria-hidden="true">
                              {getVaultItemInitials(item.title)}
                            </span>
                            <span className="vault-item-copy">
                              <span className="vault-item-title">{item.title}</span>
                              <span className="vault-item-meta">
                                {isUnlocked && payload.username.trim() ? (
                                  <span className="vault-item-meta-part">
                                    {payload.username}
                                  </span>
                                ) : null}
                                {payload.notes.trim() ? (
                                  <span className="vault-item-meta-part">Notes added</span>
                                ) : null}
                                {isUnlocked ? (
                                  <span className="vault-item-meta-part">
                                    {passwordDisplayText}
                                  </span>
                                ) : (
                                  <span className="vault-item-meta-part">
                                    {hasPassword
                                      ? "Username hidden - password hidden"
                                      : "Credentials unavailable until unlock"}
                                  </span>
                                )}
                              </span>
                            </span>
                          </div>
                          <div className="vault-row-actions">
                            {!isUnlocked ? (
                              <button
                                className="vault-button vault-button--locked"
                                aria-label={`Locked ${item.title}`}
                                type="button"
                                disabled
                              >
                                Locked
                              </button>
                            ) : null}
                            {isUnlocked && payload.username.trim() ? (
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
                            {isUnlocked && hasPassword ? (
                              <button
                                className="vault-button vault-button--safe"
                                aria-label={
                                  copiedPasswordItemId === item.id
                                    ? selectedItem?.id === item.id
                                      ? `Copied saved password ${item.title}`
                                      : `Copied password ${item.title}`
                                    : selectedItem?.id === item.id
                                      ? `Copy saved password ${item.title}`
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
                            {isUnlocked && hasPassword ? (
                              <button
                                className="vault-button vault-button--secondary"
                                aria-label={
                                  isPasswordRevealed
                                    ? selectedItem?.id === item.id
                                      ? `Hide row password ${item.title}`
                                      : `Hide password ${item.title}`
                                    : selectedItem?.id === item.id
                                      ? `Show row password ${item.title}`
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
                            {isUnlocked ? (
                              <>
                                <button
                                  className="vault-button vault-button--secondary"
                                  aria-label={`Open details ${item.title}`}
                                  type="button"
                                  onClick={() => selectItem(item.id)}
                                  disabled={isSyncing}
                                >
                                  Details
                                </button>
                                <button
                                  className="vault-button vault-button--secondary"
                                  aria-label={
                                    selectedItem?.id === item.id
                                      ? `Edit row ${item.title}`
                                      : `Edit ${item.title}`
                                  }
                                  type="button"
                                  onClick={() => void startEditing(item)}
                                  disabled={isSyncing}
                                >
                                  Edit
                                </button>
                              </>
                            ) : null}
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

          {isUnlocked ? (
            <aside className="vault-panel vault-detail-panel" aria-label="Vault item detail">
              {detailMode === "create" ? (
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
                      />
                    </label>
                    <button
                      className="vault-button vault-button--secondary"
                      type="button"
                      onClick={() => setIsCreatePasswordVisible((current) => !current)}
                      disabled={isSyncing}
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
              ) : selectedItem && selectedPayload ? (
                editingItemId === selectedItem.id ? (
                  <div className="vault-edit-grid">
                    <p className="vault-detail-kicker">EDIT ITEM</p>
                    <h2>{selectedItem.title}</h2>
                    <label className="vault-field">
                      <span className="vault-label">Edit title</span>
                      <input
                        className="vault-input"
                        name={`edit-title-${selectedItem.id}`}
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
                        name={`edit-username-${selectedItem.id}`}
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
                        name={`edit-website-${selectedItem.id}`}
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
                        name={`edit-password-${selectedItem.id}`}
                        type={isEditingPasswordVisible ? "text" : "password"}
                        value={editingPassword}
                        onChange={(event) => setEditingPassword(event.target.value)}
                      />
                    </label>
                    <button
                      className="vault-button vault-button--secondary"
                      type="button"
                      onClick={() => setIsEditingPasswordVisible((current) => !current)}
                      disabled={isSyncing}
                    >
                      {isEditingPasswordVisible
                        ? "Hide edit password"
                        : "Show edit password"}
                    </button>
                    <label className="vault-field">
                      <span className="vault-label">Edit notes</span>
                      <textarea
                        className="vault-input vault-textarea"
                        name={`edit-notes-${selectedItem.id}`}
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
                  <div className="vault-detail-stack">
                    <p className="vault-detail-kicker">SELECTED ITEM</p>
                    <h2>{selectedItem.title}</h2>
                    <p>
                      {selectedPayload.username.trim()
                        ? `${selectedPayload.username} - updated today`
                        : "No username saved"}
                    </p>
                    <div className="vault-detail-fields">
                      <div className="vault-detail-field">
                        <span className="vault-label">Username</span>
                        <span className="vault-detail-value">
                          {selectedPayload.username.trim() || "No username saved"}
                        </span>
                      </div>
                      <div className="vault-detail-field">
                        <span className="vault-label">Password</span>
                        <span className="vault-detail-value vault-detail-password">
                          <span>{selectedPasswordDisplayText}</span>
                          {selectedHasPassword ? (
                            <button
                              className="vault-button vault-button--icon"
                              aria-label={
                                isSelectedPasswordRevealed
                                  ? `Hide password ${selectedItem.title}`
                                  : `Show password ${selectedItem.title}`
                              }
                              type="button"
                              onClick={() =>
                                void togglePasswordVisibility(
                                  selectedItem.id,
                                  selectedItem.encrypted_payload,
                                )
                              }
                              disabled={isSyncing}
                            >
                              {isSelectedPasswordRevealed ? "Hide" : "Show"}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    <div className="vault-detail-actions">
                      {selectedHasPassword ? (
                        <button
                          className="vault-button vault-button--primary"
                          aria-label={
                            copiedPasswordItemId === selectedItem.id
                              ? `Copied password ${selectedItem.title}`
                              : `Copy password ${selectedItem.title}`
                          }
                          type="button"
                          onClick={() =>
                            void copyPassword(
                              selectedItem.id,
                              selectedItem.encrypted_payload,
                            )
                          }
                          disabled={isSyncing}
                        >
                          {copiedPasswordItemId === selectedItem.id
                            ? "Copied password"
                            : "Copy password"}
                        </button>
                      ) : null}
                      <button
                        className="vault-button vault-button--secondary"
                        aria-label={`Edit ${selectedItem.title}`}
                        type="button"
                        onClick={() => void startEditing(selectedItem)}
                        disabled={isSyncing}
                      >
                        Edit item
                      </button>
                    </div>
                    <div className="vault-danger-zone">
                      <p className="vault-danger-title">Danger</p>
                      <p>
                        Delete remains visually separate from routine copy and edit
                        actions.
                      </p>
                      <button
                        className="vault-button vault-button--danger vault-action-danger"
                        aria-label={`Delete ${selectedItem.title}`}
                        type="button"
                        onClick={() => void deleteItem(selectedItem.id)}
                        disabled={isSyncing}
                      >
                        Delete item
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p className="vault-empty-state">Select or create a vault item.</p>
              )}
            </aside>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
