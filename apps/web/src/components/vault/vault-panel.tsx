"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useVaultSync } from "./use-vault-sync";

export function VaultPanel() {
  const {
    createItem,
    deleteItem,
    errorMessage,
    isAuthenticated,
    isLoading,
    items,
    updateItemTitle,
  } = useVaultSync();
  const [draftTitle, setDraftTitle] = useState("");
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

    const didCreate = await createItem(nextTitle);

    if (didCreate) {
      setDraftTitle("");
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

  return (
    <section>
      <h1>Vault</h1>
      <p>Keep your current unuvault items in sync across every trusted surface.</p>

      {isLoading ? <p>Loading vault...</p> : null}
      {!isLoading && !isAuthenticated ? (
        <p>Sign in from the register flow first.</p>
      ) : null}
      {errorMessage ? <p>{errorMessage}</p> : null}

      {!isLoading && isAuthenticated ? (
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
            <button type="submit" disabled={isLoading}>
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
                        disabled={isLoading}
                      >
                        Save
                      </button>
                      <button type="button" onClick={cancelEditing} disabled={isLoading}>
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
                        disabled={isLoading}
                      >
                        Edit {item.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteItem(item.id)}
                        disabled={isLoading}
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
