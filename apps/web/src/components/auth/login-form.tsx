"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWebCopy } from "../../lib/i18n/use-web-copy";
import { createIdentityBrowserClient } from "../../lib/identity/browser";
import {
  buildAuthCallbackUrl,
  buildRegisterHref,
  resolveSafeAuthNextPath,
} from "./auth-next";

export function LoginForm({
  nextPath,
  autoProvider,
}: {
  nextPath?: string;
  autoProvider?: string;
}) {
  const copy = useWebCopy().auth;
  const router = useRouter();
  const autoStartedGoogle = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "redirecting" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startGoogleSignIn() {
    setStatus("redirecting");
    setErrorMessage(null);

    try {
      const identity = createIdentityBrowserClient();
      const result = await identity.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthCallbackUrl(nextPath),
        },
      });

      if (result.error) {
        throw result.error;
      }
    } catch {
      setStatus("error");
      setErrorMessage(copy.loginError);
    }
  }

  useEffect(() => {
    if (autoProvider !== "google" || autoStartedGoogle.current) {
      return;
    }

    autoStartedGoogle.current = true;
    void startGoogleSignIn();
  }, [autoProvider, nextPath]);

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
      const result = await identity.auth.signInWithPassword({
        email,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      router.push(resolveSafeAuthNextPath(nextPath));
    } catch {
      setStatus("error");
      setErrorMessage(copy.loginError);
    }
  }

  return (
    <form
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
            }}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={status === "submitting" || status === "redirecting"}
        style={{
          borderRadius: "var(--radius-button)",
          border: "none",
          padding: "var(--space-input-padding)",
          background:
            status === "submitting" || status === "redirecting"
              ? "#334155"
              : "#0f172a",
          color: "#fff",
          fontWeight: 600,
          cursor:
            status === "submitting" || status === "redirecting"
              ? "progress"
              : "pointer",
          opacity: status === "submitting" || status === "redirecting" ? 0.82 : 1,
        }}
      >
        {status === "submitting" ? copy.loginSubmitting : copy.loginSubmit}
      </button>

      <button
        type="button"
        disabled={status === "submitting" || status === "redirecting"}
        onClick={() => {
          void startGoogleSignIn();
        }}
        style={{
          borderRadius: "var(--radius-button)",
          border: "1px solid rgba(148, 163, 184, 0.32)",
          padding: "var(--space-input-padding)",
          background: "#fff",
          color: "#0f172a",
          fontWeight: 600,
          cursor:
            status === "submitting" || status === "redirecting"
              ? "progress"
              : "pointer",
        }}
      >
        {copy.googleSubmit}
      </button>

      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
        {copy.needAccount}{" "}
        <a href={buildRegisterHref(nextPath)} style={{ color: "#1d4ed8" }}>
          {copy.createAccountLink}
        </a>
      </p>

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
