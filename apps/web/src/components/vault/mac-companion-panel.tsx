"use client";

export function MacCompanionPanel() {
  return (
    <section
      aria-label="Mac companion"
      className="vault-companion-panel"
      data-unu-primitive="state/mac-companion"
    >
      <div className="vault-companion-header">
        <div className="vault-companion-copy">
          <h2>Mac companion</h2>
          <p>Local fill requests require the unlocked Mac companion.</p>
        </div>
        <span className="vault-companion-pill">Local-first</span>
      </div>
      <p className="vault-helper-text">
        Web can manage the vault, but plaintext release stays with the trusted
        local Mac app.
      </p>
    </section>
  );
}
