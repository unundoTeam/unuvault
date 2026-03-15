"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { bootstrapProfile } from "../../../../../packages/api-client/src/auth";
import { createBrowserSupabaseClient } from "../../lib/supabase-browser";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const supabase = createBrowserSupabaseClient();
      const result = await supabase.auth.signUp({
        email,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      const accessToken = result.data.session?.access_token;

      if (!accessToken) {
        throw new Error("missing access token");
      }

      await bootstrapProfile(async (input, init) => {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
        return fetch(`${baseUrl}${input}`, init);
      }, accessToken);

      setStatus("ready");
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

      {status === "ready" ? <p>Account ready</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
    </form>
  );
}
