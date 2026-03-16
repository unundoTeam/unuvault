import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function readRequiredEnv(
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

export async function createIdentityServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    readRequiredEnv("NEXT_PUBLIC_IDENTITY_SUPABASE_URL"),
    readRequiredEnv("NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
