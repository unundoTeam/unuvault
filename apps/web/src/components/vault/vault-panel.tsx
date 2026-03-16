"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useVaultSync } from "./use-vault-sync";

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
    updateItemTitle,
  } = useVaultSync();
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUsername, setDraftUsername] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
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

    setValidationMessage(null);

    const didCreate = await createItem({
      title: nextTitle,
      username: draftUsername,
      notes: draftNotes,
    });

    if (didCreate) {
      setDraftTitle("");
      setDraftUsername("");
      setDraftNotes("");
    }
  }

  function startEditing(itemId: string, title: string) {
    setEditingItemId(itemId);
    setEditingTitle(title);
    setEditingValidationMessage(null);
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditingTitle("");
    setEditingValidationMessage(null);
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

    setEditingValidationMessage(null);

    const didSave = await updateItemTitle(editingItemId, nextTitle);

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
                  {editingItemId === item.id ? (
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
                      <button
                        type="button"
                        onClick={() => startEditing(item.id, item.title)}
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
                  )}
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
