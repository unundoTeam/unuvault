import { TrustSummary } from "../../components/security/trust-summary";

export default function SecurityPage() {
  return (
    <main>
      <h1>Security</h1>
      <TrustSummary />
      <section>
        <h2>Devices</h2>
      </section>
      <section>
        <h2>Recent activity</h2>
      </section>
    </main>
  );
}
