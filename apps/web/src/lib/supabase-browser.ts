"use client";

import { createClient } from "@supabase/supabase-js";

function readRequiredBrowserEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export function createBrowserSupabaseClient() {
  return createClient(
    readRequiredBrowserEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readRequiredBrowserEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
