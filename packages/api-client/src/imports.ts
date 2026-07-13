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

const IMPORT_REPORT_ERROR_STATUSES = new Map<string, readonly number[]>([
  ["invalid_import_report", [400]],
  ["missing_bearer_token", [401]],
  ["invalid_token", [401]],
  ["profile_not_found", [404]],
  ["import_report_too_large", [413]],
  ["unsupported_media_type", [415]],
  ["import_report_create_failed", [500]],
]);

const CANONICAL_LOWERCASE_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isPlainObjectWithExactKeys(
  payload: unknown,
  expectedKeys: readonly string[],
): payload is Record<string, unknown> {
  try {
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
  } catch {
    return false;
  }
}

function readBrowserImportReceipt(
  payload: unknown,
): BrowserImportReportReceiptResponse | null {
  try {
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
  } catch {
    return null;
  }
}

function readAllowlistedImportError(
  payload: unknown,
  status: number | null,
): string | null {
  try {
    if (
      !isPlainObjectWithExactKeys(payload, ["ok", "error"]) ||
      payload.ok !== false ||
      typeof payload.error !== "string" ||
      !IMPORT_REPORT_ERROR_CODES.has(payload.error) ||
      status === null ||
      !IMPORT_REPORT_ERROR_STATUSES.get(payload.error)?.includes(status)
    ) {
      return null;
    }

    return payload.error;
  } catch {
    return null;
  }
}

function readSafeHttpStatus(response: unknown): number | null {
  try {
    const status = (response as { status?: unknown }).status;
    return typeof status === "number" &&
      Number.isSafeInteger(status) &&
      status >= 100 &&
      status <= 599
      ? status
      : null;
  } catch {
    return null;
  }
}

function readSafeResponseOk(response: unknown): boolean | null {
  try {
    const ok = (response as { ok?: unknown }).ok;
    return typeof ok === "boolean" ? ok : null;
  } catch {
    return null;
  }
}

function readSafeResponseJson(
  response: unknown,
): (() => Promise<unknown>) | null {
  try {
    const json = (response as { json?: unknown }).json;
    return typeof json === "function" ? (json as () => Promise<unknown>) : null;
  } catch {
    return null;
  }
}

function importReportRecordFailure(status: number | null): Error {
  return new Error(`import_report_record_failed:${status ?? "unknown"}`);
}

async function readResponsePayload(
  response: unknown,
  status: number | null,
): Promise<unknown> {
  const json = readSafeResponseJson(response);
  if (json === null) {
    throw importReportRecordFailure(status);
  }

  try {
    return await Reflect.apply(json, response, []);
  } catch {
    throw importReportRecordFailure(status);
  }
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

function rebuildBrowserImportReportRequest(
  request: BrowserImportReportRequest,
): BrowserImportReportRequest {
  return {
    source: request.source,
    report: {
      counts: {
        total_rows: request.report.counts.total_rows,
        accepted_rows: request.report.counts.accepted_rows,
        malformed_rows: request.report.counts.malformed_rows,
        duplicate_rows: request.report.counts.duplicate_rows,
      },
      issues: request.report.issues.map((issue) =>
        issue.reason_code === "duplicate"
          ? {
              row_index: issue.row_index,
              reason_code: issue.reason_code,
              duplicate_of_row_index: issue.duplicate_of_row_index,
            }
          : {
              row_index: issue.row_index,
              reason_code: issue.reason_code,
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
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher("/imports/browser", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(rebuildBrowserImportReportRequest(request)),
    });
  } catch {
    throw new Error("import_report_record_failed:unknown");
  }

  const status = readSafeHttpStatus(response);
  const ok = readSafeResponseOk(response);

  if (ok === true && status === 201) {
    const receipt = readBrowserImportReceipt(
      await readResponsePayload(response, status),
    );
    if (receipt !== null) {
      return receipt;
    }

    throw importReportRecordFailure(status);
  }

  if (ok === false) {
    const error = readAllowlistedImportError(
      await readResponsePayload(response, status),
      status,
    );
    if (error !== null) {
      throw new Error(error);
    }
  }

  throw importReportRecordFailure(status);
}
