"use client";

import { createBrowserClient } from "@supabase/ssr";

const identityBrowserEnv = {
  NEXT_PUBLIC_IDENTITY_SUPABASE_URL: process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL,
  NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY,
} as const;

function readRequiredBrowserEnv(
  name:
    | "NEXT_PUBLIC_IDENTITY_SUPABASE_URL"
    | "NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY",
) {
  const value = identityBrowserEnv[name];

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
