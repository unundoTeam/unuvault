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
    <main
      data-testid="register-page-shell"
      style={{
        minHeight: "100vh",
        padding: "var(--space-page-padding)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, rgba(15, 23, 42, 0.08), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
      }}
    >
      <section
        data-testid="register-page-card"
        style={{
          width: "min(100%, 520px)",
          display: "grid",
          gap: "var(--space-section-gap)",
          padding: "var(--space-surface-padding)",
          borderRadius: "var(--radius-surface)",
          boxShadow: "var(--shadow-elevated)",
          background: "rgba(255, 255, 255, 0.94)",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          backdropFilter: "blur(14px)",
        }}
      >
        <header style={{ display: "grid", gap: "var(--space-input-padding)" }}>
          <div
            style={{
              width: "fit-content",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "rgba(37, 99, 235, 0.08)",
              color: "#1d4ed8",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Local onboarding
          </div>
          <div style={{ display: "grid", gap: "calc(var(--space-input-padding) / 2)" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 2.8rem)" }}>
              Create your unuvault account
            </h1>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
              Start with a safer home for the passwords you already use every day.
            </p>
          </div>
        </header>
        <RegisterForm nextPath={getSingleValue(resolvedSearchParams?.next)} />
      </section>
    </main>
  );
}
