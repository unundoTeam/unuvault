"use client";

import { createClient } from "@supabase/supabase-js";
import { readRequiredProductPublicSupabaseEnv } from "./env";

export function createProductBrowserClient() {
  return createClient(
    readRequiredProductPublicSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readRequiredProductPublicSupabaseEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
