"use client";

import { createBrowserClient } from "@supabase/ssr";

function readRequiredBrowserEnv(
  name:
    | "NEXT_PUBLIC_IDENTITY_SUPABASE_URL"
    | "NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY",
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createIdentityBrowserClient() {
  return createBrowserClient(
    readRequiredBrowserEnv("NEXT_PUBLIC_IDENTITY_SUPABASE_URL"),
    readRequiredBrowserEnv("NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY"),
  );
}
