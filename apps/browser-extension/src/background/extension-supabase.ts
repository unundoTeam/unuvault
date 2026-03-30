import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function readRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export function createExtensionSupabaseClient() {
  return createClient(
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY),
  );
}
