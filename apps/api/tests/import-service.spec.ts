import { describe, expect, it, vi } from "vitest";
import {
  createImportReportService,
  ImportReportPersistenceError,
  ImportReportProfileNotFoundError,
  ImportReportUnauthorizedError,
  ImportReportValidationError,
} from "../src/services/import-service";

const VALID_REQUEST = {
  source: "chrome",
  report: {
    counts: {
      total_rows: 3,
      accepted_rows: 1,
      malformed_rows: 1,
      duplicate_rows: 1,
    },
    issues: [
      { row_index: 3, reason_code: "invalid_url" },
      {
        row_index: 4,
        reason_code: "duplicate",
        duplicate_of_row_index: 2,
      },
    ],
  },
};

function cloneValidRequest(): Record<string, any> {
  return structuredClone(VALID_REQUEST);
}

function createDependencies() {
  return {
    getUserByToken: vi.fn().mockResolvedValue({
      id: "auth-user-1",
      account_id: "account-1",
      email: "user@example.com",
    }),
    getUserProfileByAccountId: vi.fn().mockResolvedValue({
      id: "profile-1",
      account_id: "account-1",
    }),
    insertBrowserImportReport: vi.fn().mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174000",
      status: "recorded",
    }),
    now: vi.fn(() => new Date("2026-07-11T00:00:00.000Z")),
  };
}

async function expectInvalid(input: unknown) {
  const deps = createDependencies();
  const service = createImportReportService(deps);
  let error: unknown;

  try {
    await service.recordBrowserImportReport("jwt-token", input);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(ImportReportValidationError);
  expect(error).toMatchObject({
    name: "ImportReportValidationError",
    message: "invalid_import_report",
    code: "invalid_import_report",
  });
  expect(JSON.stringify(error)).not.toContain("CANARY");
  expect(deps.getUserByToken).toHaveBeenCalledWith("jwt-token");
  expect(deps.getUserProfileByAccountId).toHaveBeenCalledWith("account-1");
  expect(
    JSON.stringify({
      userCalls: deps.getUserByToken.mock.calls,
      profileCalls: deps.getUserProfileByAccountId.mock.calls,
    }),
  ).not.toContain("CANARY");
  expect(deps.now).not.toHaveBeenCalled();
  expect(deps.insertBrowserImportReport).not.toHaveBeenCalled();
}

describe("createImportReportService", () => {
  it("derives profile scope and records only the rebuilt report receipt", async () => {
    const deps = createDependencies();
    const service = createImportReportService(deps);

    await expect(
      service.recordBrowserImportReport("jwt-token", VALID_REQUEST),
    ).resolves.toEqual({
      job_id: "123e4567-e89b-42d3-a456-426614174000",
      status: "recorded",
    });
    expect(deps.getUserByToken).toHaveBeenCalledTimes(1);
    expect(deps.getUserByToken).toHaveBeenCalledWith("jwt-token");
    expect(deps.getUserProfileByAccountId).toHaveBeenCalledTimes(1);
    expect(deps.getUserProfileByAccountId).toHaveBeenCalledWith("account-1");
    expect(deps.now).toHaveBeenCalledTimes(1);
    expect(deps.insertBrowserImportReport).toHaveBeenCalledTimes(1);
    expect(deps.insertBrowserImportReport).toHaveBeenCalledWith("profile-1", {
      source: "chrome",
      status: "recorded",
      totals: {
        total_rows: 3,
        accepted_rows: 1,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      duplicates: [
        {
          row_index: 4,
          reason_code: "duplicate",
          duplicate_of_row_index: 2,
        },
      ],
      malformed_rows: [{ row_index: 3, reason_code: "invalid_url" }],
      finished_at: "2026-07-11T00:00:00.000Z",
    });
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing source", { report: VALID_REQUEST.report }],
    ["missing report", { source: "chrome" }],
    ["unknown top-level key", { ...VALID_REQUEST, raw_csv: "CANARY_RAW" }],
    ["non-object report", { source: "chrome", report: "CANARY_REPORT" }],
    [
      "missing report key",
      { source: "chrome", report: { counts: VALID_REQUEST.report.counts } },
    ],
    [
      "unknown report key",
      {
        source: "chrome",
        report: { ...VALID_REQUEST.report, password: "CANARY_PASSWORD" },
      },
    ],
    [
      "non-object counts",
      {
        source: "chrome",
        report: { counts: "CANARY_COUNTS", issues: [] },
      },
    ],
    [
      "missing count key",
      {
        source: "chrome",
        report: {
          counts: { total_rows: 0, accepted_rows: 0, malformed_rows: 0 },
          issues: [],
        },
      },
    ],
    [
      "unknown count key",
      {
        source: "chrome",
        report: {
          counts: { ...VALID_REQUEST.report.counts, username: "CANARY_USER" },
          issues: VALID_REQUEST.report.issues,
        },
      },
    ],
    [
      "non-array issues",
      {
        source: "chrome",
        report: { counts: VALID_REQUEST.report.counts, issues: {} },
      },
    ],
    [
      "non-object issue",
      {
        source: "chrome",
        report: { counts: VALID_REQUEST.report.counts, issues: ["CANARY_ISSUE"] },
      },
    ],
    [
      "unknown non-duplicate issue key",
      {
        source: "chrome",
        report: {
          counts: {
            total_rows: 1,
            accepted_rows: 0,
            malformed_rows: 1,
            duplicate_rows: 0,
          },
          issues: [
            { row_index: 2, reason_code: "invalid_url", url: "CANARY_URL" },
          ],
        },
      },
    ],
    [
      "unknown duplicate issue key",
      {
        source: "chrome",
        report: {
          counts: {
            total_rows: 2,
            accepted_rows: 1,
            malformed_rows: 0,
            duplicate_rows: 1,
          },
          issues: [
            {
              row_index: 3,
              reason_code: "duplicate",
              duplicate_of_row_index: 2,
              note: "CANARY_NOTE",
            },
          ],
        },
      },
    ],
    [
      "duplicate missing target",
      {
        source: "chrome",
        report: {
          counts: {
            total_rows: 2,
            accepted_rows: 1,
            malformed_rows: 0,
            duplicate_rows: 1,
          },
          issues: [{ row_index: 3, reason_code: "duplicate" }],
        },
      },
    ],
    [
      "non-duplicate has target",
      {
        source: "chrome",
        report: {
          counts: {
            total_rows: 1,
            accepted_rows: 0,
            malformed_rows: 1,
            duplicate_rows: 0,
          },
          issues: [
            {
              row_index: 2,
              reason_code: "invalid_url",
              duplicate_of_row_index: 2,
            },
          ],
        },
      },
    ],
  ])("rejects %s with exact-key validation", async (_name, input) => {
    await expectInvalid(input);
  });

  it.each(["safari", "Chrome", "", null, 1])(
    "rejects unsupported source %j",
    async (source) => {
      const request = cloneValidRequest();
      request.source = source;
      await expectInvalid(request);
    },
  );

  it.each([
    "unknown_reason",
    "Duplicate",
    "",
    null,
    1,
  ])("rejects unsupported reason %j", async (reasonCode) => {
    const request = cloneValidRequest();
    request.report.issues[0].reason_code = reasonCode;
    await expectInvalid(request);
  });

  for (const countKey of [
    "total_rows",
    "accepted_rows",
    "malformed_rows",
    "duplicate_rows",
  ]) {
    it.each([
      ["negative", -1],
      ["fractional", 0.5],
      ["unsafe", Number.MAX_SAFE_INTEGER + 1],
      ["over limit", 3_001],
      ["infinite", Number.POSITIVE_INFINITY],
      ["non-number", "1"],
    ])("rejects %s %s count", async (_kind, value) => {
      const request = cloneValidRequest();
      request.report.counts[countKey] = value;
      await expectInvalid(request);
    });
  }

  it.each([
    [
      "count sum",
      {
        total_rows: 3,
        accepted_rows: 2,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      VALID_REQUEST.report.issues,
    ],
    [
      "issue count",
      {
        total_rows: 3,
        accepted_rows: 1,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      [VALID_REQUEST.report.issues[0]],
    ],
    [
      "duplicate partition",
      {
        total_rows: 3,
        accepted_rows: 1,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      [
        { row_index: 3, reason_code: "invalid_url" },
        { row_index: 4, reason_code: "empty_url" },
      ],
    ],
    [
      "malformed partition",
      {
        total_rows: 3,
        accepted_rows: 1,
        malformed_rows: 1,
        duplicate_rows: 1,
      },
      [
        {
          row_index: 3,
          reason_code: "duplicate",
          duplicate_of_row_index: 2,
        },
        {
          row_index: 4,
          reason_code: "duplicate",
          duplicate_of_row_index: 2,
        },
      ],
    ],
  ])("rejects a report that violates the %s formula", async (_name, counts, issues) => {
    await expectInvalid({ source: "chrome", report: { counts, issues } });
  });

  it.each([
    ["negative", -1],
    ["fractional", 2.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
    ["header row", 1],
    ["past final logical row", 5],
    ["non-number", "3"],
  ])("rejects a %s row_index", async (_name, rowIndex) => {
    const request = cloneValidRequest();
    request.report.issues[0].row_index = rowIndex;
    await expectInvalid(request);
  });

  it.each([
    ["negative", -1],
    ["fractional", 2.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
    ["header row", 1],
    ["same row", 4],
    ["later row", 5],
    ["non-number", "2"],
  ])("rejects a %s duplicate target", async (_name, target) => {
    const request = cloneValidRequest();
    request.report.issues[1].duplicate_of_row_index = target;
    await expectInvalid(request);
  });

  it("rejects unordered issue rows", async () => {
    const request = cloneValidRequest();
    request.report.issues.reverse();
    await expectInvalid(request);
  });

  it("rejects duplicate issue rows", async () => {
    const request = cloneValidRequest();
    request.report.issues[1].row_index = 3;
    await expectInvalid(request);
  });

  it("rejects a duplicate target that points to a malformed issue row", async () => {
    const request = cloneValidRequest();
    request.report.issues[0].row_index = 2;
    request.report.issues[1].duplicate_of_row_index = 2;
    await expectInvalid(request);
  });

  it("rejects a duplicate target that points to another duplicate issue row", async () => {
    await expectInvalid({
      source: "edge",
      report: {
        counts: {
          total_rows: 4,
          accepted_rows: 1,
          malformed_rows: 1,
          duplicate_rows: 2,
        },
        issues: [
          {
            row_index: 3,
            reason_code: "duplicate",
            duplicate_of_row_index: 2,
          },
          {
            row_index: 4,
            reason_code: "duplicate",
            duplicate_of_row_index: 3,
          },
          { row_index: 5, reason_code: "empty_url" },
        ],
      },
    });
  });

  it("accepts an empty, internally consistent report", async () => {
    const deps = createDependencies();
    const service = createImportReportService(deps);

    await expect(
      service.recordBrowserImportReport("jwt-token", {
        source: "edge",
        report: {
          counts: {
            total_rows: 0,
            accepted_rows: 0,
            malformed_rows: 0,
            duplicate_rows: 0,
          },
          issues: [],
        },
      }),
    ).resolves.toEqual({
      job_id: "123e4567-e89b-42d3-a456-426614174000",
      status: "recorded",
    });
  });

  it.each([
    [null],
    [{ id: "auth-user-1", account_id: null }],
    [{ id: "auth-user-1", account_id: "" }],
  ])("returns a stable unauthorized error without persistence for %j", async (user) => {
    const deps = createDependencies();
    deps.getUserByToken.mockResolvedValue(user);
    const service = createImportReportService(deps);

    await expect(
      service.recordBrowserImportReport("jwt-token", VALID_REQUEST),
    ).rejects.toMatchObject({
      name: "ImportReportUnauthorizedError",
      message: "invalid_token",
      code: "invalid_token",
    });
    await expect(
      service.recordBrowserImportReport("jwt-token", VALID_REQUEST),
    ).rejects.toBeInstanceOf(ImportReportUnauthorizedError);
    expect(deps.getUserProfileByAccountId).not.toHaveBeenCalled();
    expect(deps.now).not.toHaveBeenCalled();
    expect(deps.insertBrowserImportReport).not.toHaveBeenCalled();
  });

  it("returns a stable profile error without persistence", async () => {
    const deps = createDependencies();
    deps.getUserProfileByAccountId.mockResolvedValue(null);
    const service = createImportReportService(deps);

    await expect(
      service.recordBrowserImportReport("jwt-token", VALID_REQUEST),
    ).rejects.toMatchObject({
      name: "ImportReportProfileNotFoundError",
      message: "profile_not_found",
      code: "profile_not_found",
    });
    await expect(
      service.recordBrowserImportReport("jwt-token", VALID_REQUEST),
    ).rejects.toBeInstanceOf(ImportReportProfileNotFoundError);
    expect(deps.getUserProfileByAccountId).toHaveBeenCalledWith("account-1");
    expect(deps.now).not.toHaveBeenCalled();
    expect(deps.insertBrowserImportReport).not.toHaveBeenCalled();
  });

  it.each([
    ["identity lookup", "getUserByToken"],
    ["profile lookup", "getUserProfileByAccountId"],
    ["insert", "insertBrowserImportReport"],
  ])("redacts a %s failure as the static persistence error", async (_name, method) => {
    const deps = createDependencies();
    deps[method as keyof typeof deps].mockRejectedValue(
      new Error("CANARY_PROVIDER_SECRET"),
    );
    const service = createImportReportService(deps);

    let error: unknown;
    try {
      await service.recordBrowserImportReport("jwt-token", VALID_REQUEST);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ImportReportPersistenceError);
    expect(error).toMatchObject({
      name: "ImportReportPersistenceError",
      message: "import_report_create_failed",
      code: "import_report_create_failed",
    });
    expect(JSON.stringify(error)).not.toContain("CANARY_PROVIDER_SECRET");
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing status", { id: "123e4567-e89b-42d3-a456-426614174000" }],
    [
      "extra field",
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        status: "recorded",
        detail: "CANARY_DB_DETAIL",
      },
    ],
    ["non-v4 id", { id: "123e4567-e89b-12d3-a456-426614174000", status: "recorded" }],
    ["uppercase id", { id: "123E4567-E89B-42D3-A456-426614174000", status: "recorded" }],
    ["wrong status", { id: "123e4567-e89b-42d3-a456-426614174000", status: "pending" }],
  ])("rejects malformed adapter result: %s", async (_name, result) => {
    const deps = createDependencies();
    deps.insertBrowserImportReport.mockResolvedValue(result);
    const service = createImportReportService(deps);

    let error: unknown;
    try {
      await service.recordBrowserImportReport("jwt-token", VALID_REQUEST);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ImportReportPersistenceError);
    expect(error).toMatchObject({
      message: "import_report_create_failed",
      code: "import_report_create_failed",
    });
    expect(JSON.stringify(error)).not.toContain("CANARY_DB_DETAIL");
  });

  it("rejects inherited fields and custom object prototypes", async () => {
    const request = cloneValidRequest();
    Object.setPrototypeOf(request, { raw_csv: "CANARY_RAW_CREDENTIAL" });
    await expectInvalid(request);
  });

  it("rejects class instances even when their own keys match", async () => {
    class ImportRequest {
      source = "chrome";
      report = structuredClone(VALID_REQUEST.report);
    }

    await expectInvalid(new ImportRequest());
  });

  it("accepts null-prototype plain objects and rebuilds their fields", async () => {
    const deps = createDependencies();
    const service = createImportReportService(deps);
    const request = Object.assign(Object.create(null), cloneValidRequest());

    await expect(
      service.recordBrowserImportReport("jwt-token", request),
    ).resolves.toEqual({
      job_id: "123e4567-e89b-42d3-a456-426614174000",
      status: "recorded",
    });
  });

  it("rejects non-enumerable unknown own keys", async () => {
    const request = cloneValidRequest();
    Object.defineProperty(request, "raw_csv", {
      value: "CANARY_NON_ENUMERABLE",
      enumerable: false,
    });
    await expectInvalid(request);
  });

  it("rejects symbol unknown own keys", async () => {
    const request = cloneValidRequest();
    Object.defineProperty(request, Symbol("CANARY_SYMBOL"), {
      value: "CANARY_SYMBOL_VALUE",
      enumerable: true,
    });
    await expectInvalid(request);
  });

  it("resolves authentication and profile before reading an invalid report", async () => {
    const deps = createDependencies();
    deps.getUserByToken.mockResolvedValue(null);
    const sourceGetter = vi.fn(() => {
      throw new Error("CANARY_BODY_GETTER");
    });
    const request = Object.create(null);
    Object.defineProperties(request, {
      source: { enumerable: true, get: sourceGetter },
      report: { enumerable: true, value: null },
    });
    const service = createImportReportService(deps);

    await expect(
      service.recordBrowserImportReport("jwt-token", request),
    ).rejects.toMatchObject({
      name: "ImportReportUnauthorizedError",
      message: "invalid_token",
      code: "invalid_token",
    });
    expect(sourceGetter).not.toHaveBeenCalled();
    expect(deps.getUserProfileByAccountId).not.toHaveBeenCalled();
    expect(deps.insertBrowserImportReport).not.toHaveBeenCalled();
  });
});
