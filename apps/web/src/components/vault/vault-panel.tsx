"use client";

import { useVaultSync } from "./use-vault-sync";

export function VaultPanel() {
  const { errorMessage, isAuthenticated, isLoading, items } = useVaultSync();

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
        items.length > 0 ? (
          <ul>
            {items.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        ) : (
          <p>No vault items yet.</p>
        )
      ) : null}
    </section>
  );
}
