export type BrowserImportSource = "chrome" | "edge";

export type BrowserImportRowReasonCode =
  | "empty_row"
  | "malformed_row"
  | "empty_url"
  | "empty_password"
  | "url_too_long"
  | "username_too_long"
  | "password_too_long"
  | "name_too_long"
  | "unsupported_note"
  | "invalid_url"
  | "unsupported_url_scheme"
  | "duplicate";

type BrowserImportIssue =
  | {
      rowIndex: number;
      reasonCode: Exclude<BrowserImportRowReasonCode, "duplicate">;
    }
  | {
      rowIndex: number;
      reasonCode: "duplicate";
      duplicateOfRowIndex: number;
    };

export type BrowserImportReport = {
  counts: {
    totalRows: number;
    acceptedRows: number;
    malformedRows: number;
    duplicateRows: number;
  };
  issues: BrowserImportIssue[];
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

function readAllowlistedImportError(payload: unknown): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
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
  } catch (error) {
    if (response.ok === false) {
      throw new Error(
        `import_report_record_failed:${response.status ?? "unknown"}`,
      );
    }
    throw error;
  }
  if (response.ok === false) {
    throw new Error(
      readAllowlistedImportError(payload) ??
        `import_report_record_failed:${response.status ?? "unknown"}`,
    );
  }

  return payload as BrowserImportReportReceiptResponse;
}
