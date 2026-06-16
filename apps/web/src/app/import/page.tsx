"use client";

import { ImportReport } from "../../components/import/report";
import { useWebCopy } from "../../lib/i18n/use-web-copy";

export default function ImportPage() {
  const copy = useWebCopy().import;

  return (
    <main>
      <h1>{copy.title}</h1>
      <ImportReport title={copy.reportTitle} body={copy.reportBody} />
    </main>
  );
}
