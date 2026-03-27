import { DevSecretsHandoffPageClient } from "../../../../components/dev-secrets/handoff-page-client";

type SearchParams = {
  callback?: string | string[];
  state?: string | string[];
  app?: string | string[];
  env?: string | string[];
};

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DevSecretsHandoffPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <DevSecretsHandoffPageClient
      callbackUrl={getSingleValue(resolvedSearchParams.callback) ?? ""}
      state={getSingleValue(resolvedSearchParams.state) ?? ""}
      app={getSingleValue(resolvedSearchParams.app) ?? "unundo"}
      env={getSingleValue(resolvedSearchParams.env) ?? "local"}
    />
  );
}
