import type {
  BrowserImportReport,
  BrowserImportRowReasonCode,
  BrowserImportSource,
} from "../../domain/src/browser-import";

export type {
  BrowserImportReport,
  BrowserImportRowReasonCode,
  BrowserImportSource,
};

type BrowserImportReportWireIssue =
  | {
      row_index: number;
      reason_code: Exclude<BrowserImportRowReasonCode, "duplicate">;
    }
  | {
      row_index: number;
      reason_code: "duplicate";
      duplicate_of_row_index: number;
    };

export type BrowserImportReportRequest = {
  source: BrowserImportSource;
  report: {
    counts: {
      total_rows: number;
      accepted_rows: number;
      malformed_rows: number;
      duplicate_rows: number;
    };
    issues: BrowserImportReportWireIssue[];
  };
};

export type BrowserImportReportReceiptResponse = {
  job_id: string;
  status: "recorded";
};

type Fetcher = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok?: boolean;
  status?: number;
  json(): Promise<unknown>;
}>;

const IMPORT_REPORT_ERROR_CODES = new Set([
  "invalid_import_report",
  "missing_bearer_token",
  "invalid_token",
  "profile_not_found",
  "import_report_too_large",
  "unsupported_media_type",
  "import_report_create_failed",
]);

const CANONICAL_LOWERCASE_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isPlainObjectWithExactKeys(
  payload: unknown,
  expectedKeys: readonly string[],
): payload is Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const keys = Object.keys(payload);
  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(payload, key))
  );
}

function readBrowserImportReceipt(
  payload: unknown,
): BrowserImportReportReceiptResponse | null {
  if (!isPlainObjectWithExactKeys(payload, ["job_id", "status"])) {
    return null;
  }
  if (
    typeof payload.job_id !== "string" ||
    !CANONICAL_LOWERCASE_UUID_V4.test(payload.job_id) ||
    payload.status !== "recorded"
  ) {
    return null;
  }

  return {
    job_id: payload.job_id,
    status: "recorded",
  };
}

function readAllowlistedImportError(payload: unknown): string | null {
  if (
    isPlainObjectWithExactKeys(payload, ["ok", "error"]) &&
    payload.ok === false &&
    typeof payload.error === "string" &&
    IMPORT_REPORT_ERROR_CODES.has(payload.error)
  ) {
    return payload.error;
  }

  return null;
}

export function toBrowserImportReportRequest(
  source: BrowserImportSource,
  report: BrowserImportReport,
): BrowserImportReportRequest {
  return {
    source,
    report: {
      counts: {
        total_rows: report.counts.totalRows,
        accepted_rows: report.counts.acceptedRows,
        malformed_rows: report.counts.malformedRows,
        duplicate_rows: report.counts.duplicateRows,
      },
      issues: report.issues.map((issue) =>
        issue.reasonCode === "duplicate"
          ? {
              row_index: issue.rowIndex,
              reason_code: issue.reasonCode,
              duplicate_of_row_index: issue.duplicateOfRowIndex,
            }
          : {
              row_index: issue.rowIndex,
              reason_code: issue.reasonCode,
            },
      ),
    },
  };
}

export async function recordBrowserImportReport(
  fetcher: Fetcher,
  token: string,
  request: BrowserImportReportRequest,
): Promise<BrowserImportReportReceiptResponse> {
  const response = await fetcher("/imports/browser", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `import_report_record_failed:${response.status ?? "unknown"}`,
    );
  }
  if (response.ok === false) {
    throw new Error(
      readAllowlistedImportError(payload) ??
        `import_report_record_failed:${response.status ?? "unknown"}`,
    );
  }

  const receipt = response.ok === true ? readBrowserImportReceipt(payload) : null;
  if (receipt === null) {
    throw new Error(
      `import_report_record_failed:${response.status ?? "unknown"}`,
    );
  }

  return receipt;
}
