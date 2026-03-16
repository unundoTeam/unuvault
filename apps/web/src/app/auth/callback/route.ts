import { NextResponse } from "next/server";
import { completeIdentityCallback } from "../../../lib/identity/complete-identity-callback";
import { createIdentityServerClient } from "../../../lib/identity/server";

export async function GET(request: Request) {
  const identity = await createIdentityServerClient();
  const redirectPath = await completeIdentityCallback(request.url, {
    exchangeCodeForSession(code: string) {
      return identity.auth.exchangeCodeForSession(code);
    },
  });

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
