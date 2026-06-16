"use client";

import { DeviceList } from "../../components/security/device-list";
import { RecentActivity } from "../../components/security/recent-activity";
import { TrustSummary } from "../../components/security/trust-summary";
import { useWebCopy } from "../../lib/i18n/use-web-copy";

export default function SecurityPage() {
  const copy = useWebCopy().security;

  return (
    <main>
      <h1>{copy.title}</h1>
      <TrustSummary copy={copy.trustSummary} />
      <DeviceList copy={copy.devices} />
      <RecentActivity copy={copy.recentActivity} />
    </main>
  );
}
