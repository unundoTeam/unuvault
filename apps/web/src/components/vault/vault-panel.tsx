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
import { useWebCopy } from "../../lib/i18n/use-web-copy";
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
  const copy = useWebCopy().vault;
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
      setValidationMessage(copy.validation.titleRequired);
      return;
    }

    if (draftWebsite.trim() && !nextWebsiteUrl) {
      setValidationMessage(copy.validation.validWebsite);
      return;
    }

    if (draftPassword && !isUnlocked) {
      setValidationMessage(copy.validation.unlockBeforePassword);
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
      setEditingValidationMessage(copy.validation.editTitleRequired);
      return;
    }

    if (editingWebsite.trim() && !nextWebsiteUrl) {
      setEditingValidationMessage(copy.validation.validWebsite);
      return;
    }

    if (editingPassword && !isUnlocked) {
      setEditingValidationMessage(copy.validation.unlockBeforePassword);
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
      ? copy.status.bootstrapping
      : isSyncing && lastAction === "create"
        ? copy.status.saving
        : isSyncing && lastAction === "update"
          ? copy.status.updating
          : isSyncing && lastAction === "delete"
            ? copy.status.deleting
            : lastAction === "load"
              ? copy.status.synced
              : lastAction === "create"
                ? copy.status.saved
                : lastAction === "update"
                  ? copy.status.updated
                  : lastAction === "delete"
                    ? copy.status.deleted
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
        getHiddenPasswordPlaceholder(
          selectedItem.encrypted_payload,
          copy.items.noPasswordSaved,
        )
      : selectedItem
        ? getHiddenPasswordPlaceholder(
            selectedItem.encrypted_payload,
            copy.items.noPasswordSaved,
          )
        : "";

  return (
    <section
      aria-labelledby="vault-heading"
      className="vault-shell"
      data-unu-primitive="vault-surface"
    >
      <div className="vault-header">
        <div className="vault-title-group">
          <h1 id="vault-heading">{copy.title}</h1>
          <p>{copy.subtitle}</p>
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
              {copy.status.lastSyncedAt(formatUtcSyncTime(lastSyncedAt))}
            </p>
          ) : null}
        </div>
      </div>
      {!isBootstrapping && !isAuthenticated ? (
        <p className="vault-auth-note">{copy.authNote}</p>
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
                  ? copy.unlock.unlockedTitle
                  : mode === "needs_setup"
                    ? copy.unlock.setupTitle
                    : copy.unlock.lockedTitle}
              </h2>
              <p>
                {isUnlocked
                  ? copy.unlock.unlockedBody
                  : copy.unlock.lockedBody}
              </p>
            </div>
            {isUnlocked ? (
              <div className="vault-session-actions">
                <p className="vault-safe-pill" role="status">
                  {copy.unlock.unlockedBadge}
                </p>
                <button
                  className="vault-button vault-button--secondary"
                  type="button"
                  onClick={lock}
                >
                  {copy.unlock.lockButton}
                </button>
              </div>
            ) : (
              <form
                aria-label={copy.unlock.formLabel}
                className="vault-form vault-form--unlock"
                data-unu-primitive="form/unlock"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitUnlock();
                }}
              >
                <label className="vault-field">
                  <span className="vault-label">{copy.unlock.masterPassword}</span>
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
                    <span className="vault-label">
                      {copy.unlock.confirmMasterPassword}
                    </span>
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
                <h2 id="vault-items-heading">{copy.items.title}</h2>
                <p>
                  {isUnlocked
                    ? copy.items.unlockedBody
                    : copy.items.lockedBody}
                </p>
              </div>
              <div className="vault-toolbar">
                <label className="vault-search-field">
                  <span className="vault-visually-hidden">{copy.items.searchLabel}</span>
                  <input
                    className="vault-input"
                    disabled={!isUnlocked}
                    placeholder={
                      isUnlocked
                        ? copy.items.searchPlaceholder
                        : copy.items.lockedSearchPlaceholder
                    }
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
                    {copy.items.newLogin}
                  </button>
                ) : null}
              </div>
            </div>

            <p className="vault-review-banner" role="note">
              <span className="vault-review-label">
                {isUnlocked
                  ? copy.items.unlockedReviewLabel
                  : copy.items.lockedReviewLabel}
              </span>
              :{" "}
              {isUnlocked
                ? copy.items.unlockedReviewBody
                : copy.items.lockedReviewBody}
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
                          getHiddenPasswordPlaceholder(
                            item.encrypted_payload,
                            copy.items.noPasswordSaved,
                          )
                        : getHiddenPasswordPlaceholder(
                            item.encrypted_payload,
                            copy.items.noPasswordSaved,
                          );

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
                                  <span className="vault-item-meta-part">
                                    {copy.items.notesAdded}
                                  </span>
                                ) : null}
                                {isUnlocked ? (
                                  <span className="vault-item-meta-part">
                                    {passwordDisplayText}
                                  </span>
                                ) : (
                                  <span className="vault-item-meta-part">
                                    {hasPassword
                                      ? copy.items.usernameAndPasswordHidden
                                      : copy.items.credentialsLocked}
                                  </span>
                                )}
                              </span>
                            </span>
                          </div>
                          <div className="vault-row-actions">
                            {!isUnlocked ? (
                              <button
                                className="vault-button vault-button--locked"
                                aria-label={copy.aria.lockedItem(item.title)}
                                type="button"
                                disabled
                              >
                                {copy.items.lockedButton}
                              </button>
                            ) : null}
                            {isUnlocked && payload.username.trim() ? (
                              <button
                                className="vault-button vault-button--soft"
                                aria-label={
                                  copiedUsernameItemId === item.id
                                    ? copy.aria.copied(item.title)
                                    : copy.aria.copyUsername(item.title)
                                }
                                type="button"
                                onClick={() => void copyUsername(item.id, payload.username)}
                                disabled={isSyncing}
                              >
                                {copiedUsernameItemId === item.id
                                  ? copy.items.copied
                                  : copy.items.copyUsername}
                              </button>
                            ) : null}
                            {isUnlocked && hasPassword ? (
                              <button
                                className="vault-button vault-button--safe"
                                aria-label={
                                  copiedPasswordItemId === item.id
                                    ? selectedItem?.id === item.id
                                      ? copy.aria.copiedSavedPassword(item.title)
                                      : copy.aria.copiedPassword(item.title)
                                    : selectedItem?.id === item.id
                                      ? copy.aria.copySavedPassword(item.title)
                                      : copy.aria.copyPassword(item.title)
                                }
                                type="button"
                                onClick={() =>
                                  void copyPassword(item.id, item.encrypted_payload)
                                }
                                disabled={isSyncing || !isUnlocked}
                              >
                                {copiedPasswordItemId === item.id
                                  ? copy.items.copiedPassword
                                  : copy.items.copyPassword}
                              </button>
                            ) : null}
                            {isUnlocked && hasPassword ? (
                              <button
                                className="vault-button vault-button--secondary"
                                aria-label={
                                  isPasswordRevealed
                                    ? selectedItem?.id === item.id
                                      ? copy.aria.hideRowPassword(item.title)
                                      : copy.aria.hidePassword(item.title)
                                    : selectedItem?.id === item.id
                                      ? copy.aria.showRowPassword(item.title)
                                      : copy.aria.showPassword(item.title)
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
                                {isPasswordRevealed ? copy.items.hide : copy.items.show}
                              </button>
                            ) : null}
                            {isUnlocked ? (
                              <>
                                <button
                                  className="vault-button vault-button--secondary"
                                  aria-label={copy.aria.openDetails(item.title)}
                                  type="button"
                                  onClick={() => selectItem(item.id)}
                                  disabled={isSyncing}
                                >
                                  {copy.items.details}
                                </button>
                                <button
                                  className="vault-button vault-button--secondary"
                                  aria-label={
                                    selectedItem?.id === item.id
                                      ? copy.aria.editRow(item.title)
                                      : copy.aria.edit(item.title)
                                  }
                                  type="button"
                                  onClick={() => void startEditing(item)}
                                  disabled={isSyncing}
                                >
                                  {copy.items.edit}
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
                {items.length > 0 ? copy.items.noMatches : copy.items.empty}
              </p>
            )}
          </section>

          {isUnlocked ? (
            <aside className="vault-panel vault-detail-panel" aria-label={copy.detail.panelLabel}>
              {detailMode === "create" ? (
                <div className="vault-card vault-card--create">
                  <h2>{copy.detail.saveLoginTitle}</h2>
                  <form
                    aria-label={copy.detail.saveFormLabel}
                    className="vault-form vault-form--create"
                    data-unu-primitive="form/save-item"
                    onSubmit={handleSubmit}
                  >
                    <label className="vault-field">
                      <span className="vault-label">{copy.detail.title}</span>
                      <input
                        className="vault-input"
                        name="title"
                        type="text"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                      />
                    </label>
                    <label className="vault-field">
                      <span className="vault-label">{copy.detail.username}</span>
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
                      <span className="vault-label">{copy.detail.website}</span>
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
                      <span className="vault-label">{copy.detail.password}</span>
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
                      {isCreatePasswordVisible
                        ? copy.detail.hidePassword
                        : copy.detail.showPassword}
                    </button>
                    <label className="vault-field">
                      <span className="vault-label">{copy.detail.notes}</span>
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
                      {copy.detail.saveItem}
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
                    <p className="vault-detail-kicker">{copy.detail.editKicker}</p>
                    <h2>{selectedItem.title}</h2>
                    <label className="vault-field">
                      <span className="vault-label">{copy.detail.editTitle}</span>
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
                      <span className="vault-label">{copy.detail.editUsername}</span>
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
                      <span className="vault-label">{copy.detail.editWebsite}</span>
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
                      <span className="vault-label">{copy.detail.editPassword}</span>
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
                        ? copy.detail.hideEditPassword
                        : copy.detail.showEditPassword}
                    </button>
                    <label className="vault-field">
                      <span className="vault-label">{copy.detail.editNotes}</span>
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
                        {copy.detail.save}
                      </button>
                      <button
                        className="vault-button vault-button--secondary"
                        type="button"
                        onClick={cancelEditing}
                        disabled={isSyncing}
                      >
                        {copy.detail.cancel}
                      </button>
                    </div>
                    {editingValidationMessage ? (
                      <p className="vault-alert">{editingValidationMessage}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="vault-detail-stack">
                    <p className="vault-detail-kicker">{copy.detail.selectedKicker}</p>
                    <h2>{selectedItem.title}</h2>
                    <p>
                      {selectedPayload.username.trim()
                        ? copy.detail.updatedToday(selectedPayload.username)
                        : copy.detail.noUsernameSaved}
                    </p>
                    <div className="vault-detail-fields">
                      <div className="vault-detail-field">
                        <span className="vault-label">{copy.detail.username}</span>
                        <span className="vault-detail-value">
                          {selectedPayload.username.trim() ||
                            copy.detail.noUsernameSaved}
                        </span>
                      </div>
                      <div className="vault-detail-field">
                        <span className="vault-label">{copy.detail.password}</span>
                        <span className="vault-detail-value vault-detail-password">
                          <span>{selectedPasswordDisplayText}</span>
                          {selectedHasPassword ? (
                            <button
                              className="vault-button vault-button--icon"
                              aria-label={
                                isSelectedPasswordRevealed
                                  ? copy.aria.hidePassword(selectedItem.title)
                                  : copy.aria.showPassword(selectedItem.title)
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
                              {isSelectedPasswordRevealed
                                ? copy.items.hide
                                : copy.items.show}
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
                              ? copy.aria.copiedPassword(selectedItem.title)
                              : copy.aria.copyPassword(selectedItem.title)
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
                            ? copy.items.copiedPassword
                            : copy.items.copyPassword}
                        </button>
                      ) : null}
                      <button
                        className="vault-button vault-button--secondary"
                        aria-label={copy.aria.edit(selectedItem.title)}
                        type="button"
                        onClick={() => void startEditing(selectedItem)}
                        disabled={isSyncing}
                      >
                        {copy.detail.editItem}
                      </button>
                    </div>
                    <div className="vault-danger-zone">
                      <p className="vault-danger-title">{copy.detail.dangerTitle}</p>
                      <p>{copy.detail.dangerBody}</p>
                      <button
                        className="vault-button vault-button--danger vault-action-danger"
                        aria-label={copy.aria.delete(selectedItem.title)}
                        type="button"
                        onClick={() => void deleteItem(selectedItem.id)}
                        disabled={isSyncing}
                      >
                        {copy.detail.deleteItem}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p className="vault-empty-state">{copy.detail.selectOrCreate}</p>
              )}
            </aside>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
