import type { FormEvent } from "react";
import { useState } from "react";
import {
  hasSavedPassword,
  normalizeVaultLoginPayload,
} from "./login-payload";
import { requestAutofillCurrentTab } from "./autofill-current-tab";
import { usePopupAuth } from "./use-popup-auth";
import { usePopupUnlock } from "./use-popup-unlock";
import { usePopupVaultSearch } from "./use-popup-vault-search";

export function App() {
  const [autofillErrorMessage, setAutofillErrorMessage] = useState<string | null>(null);
  const [autofillMessage, setAutofillMessage] = useState<string | null>(null);
  const {
    authErrorMessage,
    draftEmail,
    draftPassword,
    isSignedIn,
    setDraftEmail,
    setDraftPassword,
    signIn,
    status: authStatus,
    vaultErrorMessage,
  } = usePopupAuth();
  const {
    draftConfirmPassphrase,
    draftPassphrase,
    errorMessage,
    isUnlocked,
    lock,
    mode,
    setDraftConfirmPassphrase,
    setDraftPassphrase,
    submitLabel,
    submitUnlock,
    unlockPassphrase,
  } = usePopupUnlock();
  const {
    copiedPasswordItemId,
    copiedUsernameItemId,
    copyPassword,
    copyUsername,
    getPasswordLabel,
    filteredItems,
    hasLoaded,
    hasStoredItems,
    isPasswordRevealed,
    searchQuery,
    setSearchQuery,
    togglePasswordVisibility,
  } = usePopupVaultSearch({
    isUnlocked,
    unlockPassphrase,
  });

  async function autofillCurrentPage() {
    setAutofillErrorMessage(null);
    setAutofillMessage(null);

    try {
      const response = await requestAutofillCurrentTab();

      if (response.result.status !== "filled") {
        setAutofillErrorMessage("We couldn't autofill this page.");
        return;
      }

      setAutofillMessage("Autofilled current page.");
    } catch (error) {
      setAutofillErrorMessage(
        error instanceof Error ? error.message : "We couldn't autofill this page.",
      );
    }
  }

  return (
    <section>
      <h1>unuvault</h1>
      {!isSignedIn ? (
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={draftEmail}
              onChange={(event) => setDraftEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={draftPassword}
              onChange={(event) => setDraftPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={authStatus === "signing_in"}>
            {authStatus === "signing_in" ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : isUnlocked ? (
        <>
          <button type="button" onClick={lock}>
            Lock vault
          </button>
          <button type="button" onClick={() => void autofillCurrentPage()}>
            Autofill current page
          </button>
          <p>Vault unlocked</p>
          <label>
            <span>Search vault</span>
            <input
              placeholder="Search vault"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          {!hasLoaded ? <p>Loading vault...</p> : null}
          {hasLoaded && filteredItems.length === 0 && !hasStoredItems ? (
            <p>No vault items yet.</p>
          ) : null}
          {hasLoaded && filteredItems.length === 0 && hasStoredItems ? (
            <p>No vault items match your search.</p>
          ) : null}
          {filteredItems.length > 0 ? (
            <ul>
              {filteredItems.map((item) => {
                const payload = normalizeVaultLoginPayload(item.encrypted_payload);
                const hasPassword = hasSavedPassword(item.encrypted_payload);
                const passwordRevealed = isPasswordRevealed(item.id);

                return (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    {payload.username ? <span>{payload.username}</span> : null}
                    {payload.notes.trim() ? <span>Notes added</span> : null}
                    <span>
                      {getPasswordLabel(item.id, item.encrypted_payload)}
                    </span>
                    {payload.username ? (
                      <button
                        type="button"
                        onClick={() => void copyUsername(item.id, payload.username)}
                      >
                        {copiedUsernameItemId === item.id
                          ? `Copied ${item.title}`
                          : `Copy username ${item.title}`}
                      </button>
                    ) : null}
                    {hasPassword ? (
                      <button
                        type="button"
                        onClick={() => void copyPassword(item.id, item.encrypted_payload)}
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
                      >
                        {passwordRevealed
                          ? `Hide password ${item.title}`
                          : `Show password ${item.title}`}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      ) : (
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void submitUnlock();
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
          <button type="submit">{submitLabel}</button>
        </form>
      )}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {autofillMessage ? <p>{autofillMessage}</p> : null}
      {autofillErrorMessage ? <p>{autofillErrorMessage}</p> : null}
      {authErrorMessage ? <p>{authErrorMessage}</p> : null}
      {vaultErrorMessage ? <p>{vaultErrorMessage}</p> : null}
    </section>
  );
}
