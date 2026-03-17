import type { FormEvent } from "react";
import { normalizeVaultLoginPayload } from "./login-payload";
import { usePopupAuth } from "./use-popup-auth";
import { usePopupUnlock } from "./use-popup-unlock";
import { usePopupVaultSearch } from "./use-popup-vault-search";

export function App() {
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
  } = usePopupUnlock();
  const {
    filteredItems,
    hasLoaded,
    hasStoredItems,
    searchQuery,
    setSearchQuery,
  } = usePopupVaultSearch();

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

                return (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    {payload.username ? <span>{payload.username}</span> : null}
                    {payload.notes.trim() ? <span>Notes added</span> : null}
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
      {authErrorMessage ? <p>{authErrorMessage}</p> : null}
      {vaultErrorMessage ? <p>{vaultErrorMessage}</p> : null}
    </section>
  );
}
