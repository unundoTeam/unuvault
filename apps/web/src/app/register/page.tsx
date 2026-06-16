import { getSingleSearchParam } from "../../components/auth/auth-next";
import { RegisterPageShell } from "../../components/auth/register-page-shell";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getSingleSearchParam(resolvedSearchParams?.next);

  return <RegisterPageShell nextPath={nextPath} />;
}
