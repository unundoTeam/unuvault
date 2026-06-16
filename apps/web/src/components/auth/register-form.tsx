"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useWebCopy } from "../../lib/i18n/use-web-copy";
import { createIdentityBrowserClient } from "../../lib/identity/browser";

export function RegisterForm({ nextPath }: { nextPath?: string }) {
  const copy = useWebCopy().auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "pending_confirmation" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function buildEmailRedirectUrl() {
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", nextPath ?? "/auth/finalize");
    return redirect.toString();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setStatus("error");
      setErrorMessage(copy.emailPasswordRequired);
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const identity = createIdentityBrowserClient();
      const result = await identity.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildEmailRedirectUrl(),
        },
      });

      if (result.error) {
        throw result.error;
      }

      setStatus("pending_confirmation");
    } catch {
      setStatus("error");
      setErrorMessage(copy.registerError);
    }
  }

  return (
    <form
      data-testid="register-form-shell"
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: "var(--space-card-padding)",
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-input-padding)" }}>
        <label
          style={{
            display: "grid",
            gap: "calc(var(--space-input-padding) / 2)",
          }}
        >
          <span style={{ fontWeight: 600 }}>{copy.emailLabel}</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-input-padding)",
              borderRadius: "var(--radius-input)",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              background: "rgba(248, 250, 252, 0.92)",
              transitionProperty: "border-color, box-shadow, background-color",
              transitionDuration: "var(--motion-duration-standard)",
              transitionTimingFunction: "var(--motion-ease-standard)",
            }}
          />
        </label>

        <label
          style={{
            display: "grid",
            gap: "calc(var(--space-input-padding) / 2)",
          }}
        >
          <span style={{ fontWeight: 600 }}>{copy.passwordLabel}</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-input-padding)",
              borderRadius: "var(--radius-input)",
              border: "1px solid rgba(148, 163, 184, 0.45)",
              background: "rgba(248, 250, 252, 0.92)",
              transitionProperty: "border-color, box-shadow, background-color",
              transitionDuration: "var(--motion-duration-standard)",
              transitionTimingFunction: "var(--motion-ease-standard)",
            }}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        style={{
          borderRadius: "var(--radius-button)",
          border: "none",
          padding: "var(--space-input-padding)",
          background: status === "submitting" ? "#334155" : "#0f172a",
          color: "#fff",
          fontWeight: 600,
          cursor: status === "submitting" ? "progress" : "pointer",
          opacity: status === "submitting" ? 0.82 : 1,
          transitionProperty: "opacity, transform, background-color",
          transitionDuration: "var(--motion-duration-standard)",
          transitionTimingFunction: "var(--motion-ease-standard)",
        }}
      >
        {status === "submitting" ? copy.registerSubmitting : copy.registerSubmit}
      </button>

      {status === "pending_confirmation" ? (
        <p
          style={{
            margin: 0,
            padding: "var(--space-input-padding)",
            borderRadius: "var(--radius-card)",
            background: "rgba(16, 185, 129, 0.12)",
            color: "#065f46",
            lineHeight: 1.6,
          }}
        >
          {copy.registerSuccess}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          style={{
            margin: 0,
            padding: "var(--space-input-padding)",
            borderRadius: "var(--radius-card)",
            background: "rgba(239, 68, 68, 0.12)",
            color: "#991b1b",
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
