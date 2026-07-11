import type {
  BrowserImportReportRequest,
  BrowserImportRowReasonCode,
} from "../../../../packages/api-client/src/imports";

const MAX_IMPORT_ROWS = 3_000;
const CANONICAL_LOWERCASE_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ALLOWED_SOURCES = new Set(["chrome", "edge"]);
const ALLOWED_REASON_CODES = new Set([
  "empty_row",
  "malformed_row",
  "empty_url",
  "empty_password",
  "url_too_long",
  "username_too_long",
  "password_too_long",
  "name_too_long",
  "unsupported_note",
  "invalid_url",
  "unsupported_url_scheme",
  "duplicate",
]);

type BrowserImportSource = BrowserImportReportRequest["source"];
type BrowserImportIssue =
  BrowserImportReportRequest["report"]["issues"][number];
type DuplicateIssue = Extract<BrowserImportIssue, { reason_code: "duplicate" }>;
type MalformedIssue = Exclude<BrowserImportIssue, { reason_code: "duplicate" }>;

type AuthUser = {
  account_id: string | null;
};

type ImportReportProfile = {
  id: string;
};

export type BrowserImportReportInsertRow = {
  source: BrowserImportSource;
  status: "recorded";
  totals: BrowserImportReportRequest["report"]["counts"];
  duplicates: DuplicateIssue[];
  malformed_rows: MalformedIssue[];
  finished_at: string;
};

export type ImportReportServiceDependencies = {
  getUserByToken(token: string): Promise<AuthUser | null>;
  getUserProfileByAccountId(
    accountId: string,
  ): Promise<ImportReportProfile | null>;
  insertBrowserImportReport(
    profileId: string,
    row: BrowserImportReportInsertRow,
  ): Promise<unknown>;
  now?(): Date;
};

abstract class StableImportReportError extends Error {
  abstract readonly code: string;

  protected constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}

export class ImportReportValidationError extends StableImportReportError {
  readonly code = "invalid_import_report";

  constructor() {
    super("invalid_import_report", "ImportReportValidationError");
  }
}

export class ImportReportUnauthorizedError extends StableImportReportError {
  readonly code = "invalid_token";

  constructor() {
    super("invalid_token", "ImportReportUnauthorizedError");
  }
}

export class ImportReportProfileNotFoundError extends StableImportReportError {
  readonly code = "profile_not_found";

  constructor() {
    super("profile_not_found", "ImportReportProfileNotFoundError");
  }
}

export class ImportReportPersistenceError extends StableImportReportError {
  readonly code = "import_report_create_failed";

  constructor() {
    super("import_report_create_failed", "ImportReportPersistenceError");
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isObjectRecord(value)) {
    return false;
  }

  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isBoundedCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_IMPORT_ROWS
  );
}

function isLogicalRowIndex(value: unknown, totalRows: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 2 &&
    value <= totalRows + 1
  );
}

function isAllowedSource(value: unknown): value is BrowserImportSource {
  return typeof value === "string" && ALLOWED_SOURCES.has(value);
}

function isAllowedReasonCode(
  value: unknown,
): value is BrowserImportRowReasonCode {
  return typeof value === "string" && ALLOWED_REASON_CODES.has(value);
}

function invalidReport(): never {
  throw new ImportReportValidationError();
}

function validateAndRebuildRequest(
  input: unknown,
): BrowserImportReportRequest {
  if (!hasExactOwnKeys(input, ["source", "report"])) {
    return invalidReport();
  }
  if (!isAllowedSource(input.source)) {
    return invalidReport();
  }
  if (!hasExactOwnKeys(input.report, ["counts", "issues"])) {
    return invalidReport();
  }

  const report = input.report;
  if (
    !hasExactOwnKeys(report.counts, [
      "total_rows",
      "accepted_rows",
      "malformed_rows",
      "duplicate_rows",
    ])
  ) {
    return invalidReport();
  }

  const counts = report.counts;
  if (
    !isBoundedCount(counts.total_rows) ||
    !isBoundedCount(counts.accepted_rows) ||
    !isBoundedCount(counts.malformed_rows) ||
    !isBoundedCount(counts.duplicate_rows)
  ) {
    return invalidReport();
  }
  if (!Array.isArray(report.issues)) {
    return invalidReport();
  }

  const totalRows = counts.total_rows;
  const rebuiltIssues: BrowserImportIssue[] = [];
  let previousRowIndex = 1;
  let duplicateCount = 0;
  let malformedCount = 0;

  for (const candidate of report.issues) {
    const hasMalformedKeys = hasExactOwnKeys(candidate, [
      "row_index",
      "reason_code",
    ]);
    const hasDuplicateKeys = hasExactOwnKeys(candidate, [
      "row_index",
      "reason_code",
      "duplicate_of_row_index",
    ]);
    if (!hasMalformedKeys && !hasDuplicateKeys) {
      return invalidReport();
    }
    if (
      !isLogicalRowIndex(candidate.row_index, totalRows) ||
      candidate.row_index <= previousRowIndex ||
      !isAllowedReasonCode(candidate.reason_code)
    ) {
      return invalidReport();
    }

    previousRowIndex = candidate.row_index;
    if (candidate.reason_code === "duplicate") {
      if (
        !hasDuplicateKeys ||
        typeof candidate.duplicate_of_row_index !== "number" ||
        !Number.isSafeInteger(candidate.duplicate_of_row_index) ||
        candidate.duplicate_of_row_index < 2 ||
        candidate.duplicate_of_row_index >= candidate.row_index
      ) {
        return invalidReport();
      }
      duplicateCount += 1;
      rebuiltIssues.push({
        row_index: candidate.row_index,
        reason_code: "duplicate",
        duplicate_of_row_index: candidate.duplicate_of_row_index,
      });
    } else {
      if (!hasMalformedKeys) {
        return invalidReport();
      }
      malformedCount += 1;
      rebuiltIssues.push({
        row_index: candidate.row_index,
        reason_code: candidate.reason_code,
      });
    }
  }

  if (
    counts.accepted_rows + counts.malformed_rows + counts.duplicate_rows !==
      totalRows ||
    rebuiltIssues.length !==
      counts.malformed_rows + counts.duplicate_rows ||
    duplicateCount !== counts.duplicate_rows ||
    malformedCount !== counts.malformed_rows
  ) {
    return invalidReport();
  }

  const issueRows = new Set(rebuiltIssues.map((issue) => issue.row_index));
  for (const issue of rebuiltIssues) {
    if (
      issue.reason_code === "duplicate" &&
      issueRows.has(issue.duplicate_of_row_index)
    ) {
      return invalidReport();
    }
  }

  return {
    source: input.source,
    report: {
      counts: {
        total_rows: counts.total_rows,
        accepted_rows: counts.accepted_rows,
        malformed_rows: counts.malformed_rows,
        duplicate_rows: counts.duplicate_rows,
      },
      issues: rebuiltIssues,
    },
  };
}

export function validateBrowserImportReportRequest(
  input: unknown,
): BrowserImportReportRequest {
  try {
    return validateAndRebuildRequest(input);
  } catch (error) {
    if (error instanceof ImportReportValidationError) {
      throw error;
    }
    throw new ImportReportValidationError();
  }
}

function isRecordedAdapterResult(
  result: unknown,
): result is { id: string; status: "recorded" } {
  return (
    hasExactOwnKeys(result, ["id", "status"]) &&
    typeof result.id === "string" &&
    CANONICAL_LOWERCASE_UUID_V4.test(result.id) &&
    result.status === "recorded"
  );
}

export function createImportReportService(
  deps: ImportReportServiceDependencies,
) {
  const now = deps.now ?? (() => new Date());

  return {
    async recordBrowserImportReport(token: string, input: unknown) {
      let profile: ImportReportProfile;

      try {
        const user = await deps.getUserByToken(token);
        if (
          !user ||
          typeof user.account_id !== "string" ||
          user.account_id.length === 0
        ) {
          throw new ImportReportUnauthorizedError();
        }

        const resolvedProfile = await deps.getUserProfileByAccountId(
          user.account_id,
        );
        if (!resolvedProfile) {
          throw new ImportReportProfileNotFoundError();
        }
        if (
          typeof resolvedProfile.id !== "string" ||
          resolvedProfile.id.length === 0
        ) {
          throw new ImportReportPersistenceError();
        }
        profile = resolvedProfile;
      } catch (error) {
        if (
          error instanceof ImportReportUnauthorizedError ||
          error instanceof ImportReportProfileNotFoundError ||
          error instanceof ImportReportPersistenceError
        ) {
          throw error;
        }
        throw new ImportReportPersistenceError();
      }

      const request = validateBrowserImportReportRequest(input);

      try {
        const finishedAt = now().toISOString();
        const duplicates: DuplicateIssue[] = [];
        const malformedRows: MalformedIssue[] = [];
        for (const issue of request.report.issues) {
          if (issue.reason_code === "duplicate") {
            duplicates.push({
              row_index: issue.row_index,
              reason_code: "duplicate",
              duplicate_of_row_index: issue.duplicate_of_row_index,
            });
          } else {
            malformedRows.push({
              row_index: issue.row_index,
              reason_code: issue.reason_code,
            });
          }
        }

        const result = await deps.insertBrowserImportReport(profile.id, {
          source: request.source,
          status: "recorded",
          totals: {
            total_rows: request.report.counts.total_rows,
            accepted_rows: request.report.counts.accepted_rows,
            malformed_rows: request.report.counts.malformed_rows,
            duplicate_rows: request.report.counts.duplicate_rows,
          },
          duplicates,
          malformed_rows: malformedRows,
          finished_at: finishedAt,
        });
        if (!isRecordedAdapterResult(result)) {
          throw new ImportReportPersistenceError();
        }

        return { job_id: result.id, status: "recorded" as const };
      } catch (error) {
        if (error instanceof ImportReportPersistenceError) {
          throw error;
        }
        throw new ImportReportPersistenceError();
      }
    },
  };
}

/** @deprecated Removed when the authenticated receipt route lands in Task 5. */
export function createBrowserImportJob() {
  return { job_id: "job_123", status: "pending" };
}
