import { DeviceList } from "../../components/security/device-list";
import { RecentActivity } from "../../components/security/recent-activity";
import { TrustSummary } from "../../components/security/trust-summary";

export default function SecurityPage() {
  return (
    <main>
      <h1>Security</h1>
      <TrustSummary />
      <DeviceList />
      <RecentActivity />
    </main>
  );
}
