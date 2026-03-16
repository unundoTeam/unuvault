import { redirect } from "next/navigation";
import { bootstrapProfile } from "../../../../../../packages/api-client/src/auth";
import { bootstrapUnuvaultProfile } from "../../../lib/identity/bootstrap-unuvault-profile";
import { createIdentityServerClient } from "../../../lib/identity/server";

function readApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export default async function FinalizePage() {
  try {
    const identity = await createIdentityServerClient();

    await bootstrapUnuvaultProfile({
      getSession() {
        return identity.auth.getSession();
      },
      bootstrapProfile(token: string) {
        return bootstrapProfile(async (input, init) => {
          return fetch(`${readApiBaseUrl()}${input}`, init);
        }, token);
      },
    });
  } catch {
    redirect("/register?authError=bootstrap_failed");
  }

  redirect("/vault");
}
