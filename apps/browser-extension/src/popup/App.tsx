import type { FormEvent } from "react";
import { useState } from "react";
import { usePopupUnlock } from "./use-popup-unlock";

export function App() {
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
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <section>
      <h1>unuvault</h1>
      {isUnlocked ? (
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
          <p>Vault search will connect in the next slice</p>
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
    </section>
  );
}
