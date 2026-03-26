import { RegisterForm } from "../../components/auth/register-form";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: {
    next?: string;
  };
}) {
  return (
    <main>
      <h1>Create your unuvault account</h1>
      <p>Start with a safer home for the passwords you already use every day.</p>
      <RegisterForm nextPath={searchParams?.next} />
    </main>
  );
}
