"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createIdentityBrowserClient } from "../../lib/identity/browser";

export function RegisterForm({ nextPath }: { nextPath?: string }) {
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
      setErrorMessage("Email and password are required.");
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
      setErrorMessage("We couldn't create your account. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        <span>Email</span>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Creating account..." : "Create account"}
      </button>

      {status === "pending_confirmation" ? (
        <p>Check your email to finish setting up unuvault.</p>
      ) : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
    </form>
  );
}
