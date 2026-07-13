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

function snapshotPlainDataObject(
  value: unknown,
  allowedKeySets: readonly (readonly string[])[],
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(value);
  const matchingKeys = allowedKeySets.find(
    (expectedKeys) =>
      ownKeys.length === expectedKeys.length &&
      expectedKeys.every((key) => ownKeys.includes(key)),
  );
  if (!matchingKeys) {
    return null;
  }

  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of matchingKeys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, "value")
    ) {
      return null;
    }
    snapshot[key] = descriptor.value;
  }

  return snapshot;
}

function snapshotPlainDataProperties(
  value: unknown,
  propertyNames: readonly string[],
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const snapshot: Record<string, unknown> = Object.create(null);
  for (const propertyName of propertyNames) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, propertyName);
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, "value")
    ) {
      return null;
    }
    snapshot[propertyName] = descriptor.value;
  }

  return snapshot;
}

function snapshotDensePlainArray(
  value: unknown,
  maximumLength: number,
): unknown[] | null {
  if (!Array.isArray(value) || Reflect.getPrototypeOf(value) !== Array.prototype) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(value);
  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
  if (
    !lengthDescriptor ||
    lengthDescriptor.enumerable !== false ||
    !Object.hasOwn(lengthDescriptor, "value") ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > maximumLength
  ) {
    return null;
  }

  const length = lengthDescriptor.value;
  if (
    ownKeys.length !== length + 1 ||
    !ownKeys.includes("length") ||
    Array.from({ length }, (_, index) => String(index)).some(
      (key) => !ownKeys.includes(key),
    )
  ) {
    return null;
  }

  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
    if (
      !descriptor ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, "value")
    ) {
      return null;
    }
    snapshot[index] = descriptor.value;
  }

  return snapshot;
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
  const inputSnapshot = snapshotPlainDataObject(input, [["source", "report"]]);
  if (!inputSnapshot) {
    return invalidReport();
  }
  const source = inputSnapshot.source;
  if (!isAllowedSource(source)) {
    return invalidReport();
  }
  const reportSnapshot = snapshotPlainDataObject(inputSnapshot.report, [
    ["counts", "issues"],
  ]);
  if (!reportSnapshot) {
    return invalidReport();
  }

  const countsSnapshot = snapshotPlainDataObject(reportSnapshot.counts, [
    [
      "total_rows",
      "accepted_rows",
      "malformed_rows",
      "duplicate_rows",
    ],
  ]);
  if (!countsSnapshot) {
    return invalidReport();
  }

  if (
    !isBoundedCount(countsSnapshot.total_rows) ||
    !isBoundedCount(countsSnapshot.accepted_rows) ||
    !isBoundedCount(countsSnapshot.malformed_rows) ||
    !isBoundedCount(countsSnapshot.duplicate_rows)
  ) {
    return invalidReport();
  }
  const issueValues = snapshotDensePlainArray(
    reportSnapshot.issues,
    MAX_IMPORT_ROWS,
  );
  if (!issueValues) {
    return invalidReport();
  }

  const totalRows = countsSnapshot.total_rows;
  const rebuiltIssues: BrowserImportIssue[] = [];
  let previousRowIndex = 1;
  let duplicateCount = 0;
  let malformedCount = 0;

  for (const issueValue of issueValues) {
    const candidate = snapshotPlainDataObject(issueValue, [
      ["row_index", "reason_code"],
      ["row_index", "reason_code", "duplicate_of_row_index"],
    ]);
    if (!candidate) {
      return invalidReport();
    }
    const hasDuplicateTarget = Object.hasOwn(
      candidate,
      "duplicate_of_row_index",
    );
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
        !hasDuplicateTarget ||
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
      if (hasDuplicateTarget) {
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
    countsSnapshot.accepted_rows +
        countsSnapshot.malformed_rows +
        countsSnapshot.duplicate_rows !==
      totalRows ||
    rebuiltIssues.length !==
      countsSnapshot.malformed_rows + countsSnapshot.duplicate_rows ||
    duplicateCount !== countsSnapshot.duplicate_rows ||
    malformedCount !== countsSnapshot.malformed_rows
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
    source,
    report: {
      counts: {
        total_rows: countsSnapshot.total_rows,
        accepted_rows: countsSnapshot.accepted_rows,
        malformed_rows: countsSnapshot.malformed_rows,
        duplicate_rows: countsSnapshot.duplicate_rows,
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
  } catch {
    throw new ImportReportValidationError();
  }
}

function readRecordedAdapterResult(
  result: unknown,
): { id: string; status: "recorded" } | null {
  const snapshot = snapshotPlainDataObject(result, [["id", "status"]]);
  if (
    !snapshot ||
    typeof snapshot.id !== "string" ||
    !CANONICAL_LOWERCASE_UUID_V4.test(snapshot.id) ||
    snapshot.status !== "recorded"
  ) {
    return null;
  }

  return { id: snapshot.id, status: "recorded" };
}

export function createImportReportService(
  deps: ImportReportServiceDependencies,
) {
  const now = deps.now ?? (() => new Date());

  return {
    async recordBrowserImportReport(token: string, input: unknown) {
      let user: AuthUser | null;
      try {
        user = await deps.getUserByToken(token);
      } catch {
        throw new ImportReportPersistenceError();
      }
      if (!user) {
        throw new ImportReportUnauthorizedError();
      }

      let userSnapshot: Record<string, unknown> | null;
      try {
        userSnapshot = snapshotPlainDataProperties(user, ["account_id"]);
      } catch {
        throw new ImportReportPersistenceError();
      }
      const accountId = userSnapshot?.account_id;
      if (typeof accountId !== "string" || accountId.length === 0) {
        throw new ImportReportUnauthorizedError();
      }

      let resolvedProfile: ImportReportProfile | null;
      try {
        resolvedProfile = await deps.getUserProfileByAccountId(
          accountId,
        );
      } catch {
        throw new ImportReportPersistenceError();
      }
      if (!resolvedProfile) {
        throw new ImportReportProfileNotFoundError();
      }

      let profileSnapshot: Record<string, unknown> | null;
      try {
        profileSnapshot = snapshotPlainDataProperties(resolvedProfile, [
          "id",
        ]);
      } catch {
        throw new ImportReportPersistenceError();
      }
      const profileId = profileSnapshot?.id;
      if (typeof profileId !== "string" || profileId.length === 0) {
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

        const adapterResult = await deps.insertBrowserImportReport(profileId, {
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
        const receipt = readRecordedAdapterResult(adapterResult);
        if (!receipt) {
          throw new ImportReportPersistenceError();
        }

        return { job_id: receipt.id, status: "recorded" as const };
      } catch {
        throw new ImportReportPersistenceError();
      }
    },
  };
}

/** @deprecated Removed when the authenticated receipt route lands. */
export function createBrowserImportJob() {
  return { job_id: "job_123", status: "pending" };
}
