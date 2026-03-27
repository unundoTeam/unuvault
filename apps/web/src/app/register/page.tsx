import { RegisterForm } from "../../components/auth/register-form";

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <main>
      <h1>Create your unuvault account</h1>
      <p>Start with a safer home for the passwords you already use every day.</p>
      <RegisterForm nextPath={getSingleValue(resolvedSearchParams?.next)} />
    </main>
  );
}
