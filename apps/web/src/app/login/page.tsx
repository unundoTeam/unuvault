import { getSingleSearchParam } from "../../components/auth/auth-next";
import { LoginPageShell } from "../../components/auth/login-page-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    next?: string | string[];
    provider?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getSingleSearchParam(resolvedSearchParams?.next);
  const provider = getSingleSearchParam(resolvedSearchParams?.provider);

  return <LoginPageShell nextPath={nextPath} provider={provider} />;
}
