import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  BrowserImportReport as DomainBrowserImportReport,
  BrowserImportRowReasonCode as DomainBrowserImportRowReasonCode,
  BrowserImportSource as DomainBrowserImportSource,
} from "../../domain/src/browser-import";
import {
  recordBrowserImportReport,
  toBrowserImportReportRequest,
  type BrowserImportReport,
  type BrowserImportRowReasonCode,
  type BrowserImportSource,
} from "../src/imports";

describe("browser import report client", () => {
  it("rebuilds only sanitized report fields with snake_case wire keys", () => {
    const report = {
      counts: {
        totalRows: 3,
        acceptedRows: 1,
        malformedRows: 1,
        duplicateRows: 1,
      },
      issues: [
        { rowIndex: 3, reasonCode: "invalid_url" as const },
        {
          rowIndex: 4,
          reasonCode: "duplicate" as const,
          duplicateOfRowIndex: 2,
          password: "issue-password-canary",
        },
      ],
      acceptedEntries: [
        {
          username: "accepted-username-canary",
          password: "accepted-password-canary",
        },
      ],
    };

    const request = toBrowserImportReportRequest("chrome", report);

    expect(request).toEqual({
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
    });
    expect(JSON.stringify(request)).not.toContain("canary");
  });

  it("keeps the browser-import row reason union fixed to the client core", () => {
    expectTypeOf<BrowserImportRowReasonCode>().toEqualTypeOf<
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
      | "duplicate"
    >();
  });

  it("type-only imports and re-exports the domain browser-import contract", () => {
    expectTypeOf<BrowserImportSource>().toEqualTypeOf<DomainBrowserImportSource>();
    expectTypeOf<BrowserImportRowReasonCode>().toEqualTypeOf<
      DomainBrowserImportRowReasonCode
    >();
    expectTypeOf<BrowserImportReport>().toEqualTypeOf<DomainBrowserImportReport>();

    const moduleSource = readFileSync(
      new URL("../src/imports.ts", import.meta.url),
      "utf8",
    );
    expect(moduleSource).toContain('from "../../domain/src/browser-import"');
    expect(moduleSource).not.toMatch(
      /export type BrowserImport(?:Source|RowReasonCode|Report)\s*=/,
    );
  });

  it("posts a sanitized browser import report with bearer auth", async () => {
    const jobId = "123e4567-e89b-42d3-a456-426614174000";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ job_id: jobId, status: "recorded" }),
    });
    const request = {
      source: "chrome" as const,
      report: {
        counts: {
          total_rows: 1,
          accepted_rows: 1,
          malformed_rows: 0,
          duplicate_rows: 0,
        },
        issues: [],
      },
    };

    const response = await recordBrowserImportReport(
      fetcher,
      "jwt-token",
      request,
    );

    expect(response).toEqual({ job_id: jobId, status: "recorded" });
    expectTypeOf(response).toEqualTypeOf<{
      job_id: string;
      status: "recorded";
    }>();
    expect(fetcher).toHaveBeenCalledWith("/imports/browser", {
      method: "POST",
      headers: {
        authorization: "Bearer jwt-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
  });

  it("does not surface a fetcher rejection", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error("provider-secret-canary"));

    let failure: unknown;
    try {
      await recordBrowserImportReport(fetcher, "jwt-token", {
        source: "chrome",
        report: {
          counts: {
            total_rows: 0,
            accepted_rows: 0,
            malformed_rows: 0,
            duplicate_rows: 0,
          },
          issues: [],
        },
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toEqual(
      new Error("import_report_record_failed:unknown"),
    );
    expect(String(failure)).not.toContain("provider-secret-canary");
  });

  it("rebuilds the exact wire DTO before sending a structurally compatible request", async () => {
    const jobId = "123e4567-e89b-42d3-a456-426614174000";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ job_id: jobId, status: "recorded" }),
    });
    const request = {
      source: "edge" as const,
      report: {
        counts: {
          total_rows: 2,
          accepted_rows: 1,
          malformed_rows: 0,
          duplicate_rows: 1,
          internal_count: "count-secret-canary",
        },
        issues: [
          {
            row_index: 2,
            reason_code: "duplicate" as const,
            duplicate_of_row_index: 1,
            password: "issue-password-secret-canary",
          },
        ],
        acceptedEntries: [
          {
            username: "accepted-username-secret-canary",
            password: "accepted-password-secret-canary",
          },
        ],
      },
      internal: "request-secret-canary",
    };

    await recordBrowserImportReport(fetcher, "jwt-token", request);

    const body = fetcher.mock.calls[0]?.[1]?.body;
    expect(JSON.parse(body ?? "null")).toEqual({
      source: "edge",
      report: {
        counts: {
          total_rows: 2,
          accepted_rows: 1,
          malformed_rows: 0,
          duplicate_rows: 1,
        },
        issues: [
          {
            row_index: 2,
            reason_code: "duplicate",
            duplicate_of_row_index: 1,
          },
        ],
      },
    });
    expect(body).not.toContain("canary");
  });

  it.each([
    {
      name: "an extra key",
      ok: true,
      payload: {
        job_id: "123e4567-e89b-42d3-a456-426614174000",
        status: "recorded",
        internal: "receipt-secret-canary",
      },
    },
    {
      name: "the wrong status",
      ok: true,
      payload: {
        job_id: "123e4567-e89b-42d3-a456-426614174000",
        status: "completed",
      },
    },
    {
      name: "a non-UUID job id",
      ok: true,
      payload: { job_id: "job-1", status: "recorded" },
    },
    {
      name: "an uppercase UUID",
      ok: true,
      payload: {
        job_id: "123E4567-E89B-42D3-A456-426614174000",
        status: "recorded",
      },
    },
    {
      name: "a non-v4 UUID",
      ok: true,
      payload: {
        job_id: "123e4567-e89b-12d3-a456-426614174000",
        status: "recorded",
      },
    },
    { name: "null", ok: true, payload: null },
    { name: "an array", ok: true, payload: [] },
    {
      name: "an absent ok flag",
      ok: undefined,
      payload: {
        job_id: "123e4567-e89b-42d3-a456-426614174000",
        status: "recorded",
      },
    },
  ])("rejects a 2xx receipt with $name", async ({ ok, payload }) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok,
      status: 201,
      json: async () => payload,
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
        source: "chrome",
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
    ).rejects.toThrow("import_report_record_failed:201");
  });

  it.each([
    [400, "invalid_import_report"],
    [401, "missing_bearer_token"],
    [401, "invalid_token"],
    [404, "profile_not_found"],
    [413, "import_report_too_large"],
    [415, "unsupported_media_type"],
    [500, "import_report_create_failed"],
  ] as const)(
    "surfaces HTTP %s allowlisted contract error %s",
    async (status, error) => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ ok: false, error }),
      });

      await expect(
        recordBrowserImportReport(fetcher, "jwt-token", {
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
      ).rejects.toEqual(new Error(error));
    },
  );

  it.each([
    [500, "invalid_token"],
    [401, "import_report_create_failed"],
  ] as const)(
    "does not surface mismatched HTTP %s allowlisted error %s",
    async (status, error) => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ ok: false, error }),
      });

      await expect(
        recordBrowserImportReport(fetcher, "jwt-token", {
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
      ).rejects.toEqual(new Error(`import_report_record_failed:${status}`));
    },
  );

  it.each([
    {
      name: "a missing ok field",
      payload: { error: "invalid_token" },
    },
    {
      name: "ok true",
      payload: { ok: true, error: "invalid_token" },
    },
    {
      name: "an extra key",
      payload: {
        ok: false,
        error: "invalid_token",
        internal: "error-secret-canary",
      },
    },
    { name: "null", payload: null },
    { name: "an array", payload: ["invalid_token"] },
    {
      name: "a non-plain object",
      payload: Object.assign(Object.create({ inherited: true }), {
        ok: false,
        error: "invalid_token",
      }),
    },
  ])("does not surface an allowlisted code from $name", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => payload,
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
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
    ).rejects.toThrow("import_report_record_failed:401");
  });

  it.each([
    {
      name: "an arbitrary server error",
      status: 502,
      payload: { error: "database-secret-canary" },
      expected: "import_report_record_failed:502",
    },
    {
      name: "a missing error field",
      status: 503,
      payload: { ok: false },
      expected: "import_report_record_failed:503",
    },
    {
      name: "a missing status",
      status: undefined,
      payload: { error: "internal-canary" },
      expected: "import_report_record_failed:unknown",
    },
  ])("uses the static fallback for $name", async ({ status, payload, expected }) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => payload,
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
        source: "chrome",
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
    ).rejects.toThrow(expected);
  });

  it("does not surface a non-2xx JSON parsing error", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("response-parser-secret-canary");
      },
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
        source: "chrome",
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
    ).rejects.toThrow("import_report_record_failed:502");
  });

  it("does not surface a 2xx JSON parsing error", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => {
        throw new Error("success-parser-secret-canary");
      },
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
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
    ).rejects.toThrow("import_report_record_failed:201");
  });

  it.each([200, 202])(
    "rejects an otherwise valid receipt at HTTP %s",
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        status,
        json: async () => ({
          job_id: "123e4567-e89b-42d3-a456-426614174000",
          status: "recorded",
        }),
      });

      await expect(
        recordBrowserImportReport(fetcher, "jwt-token", {
          source: "chrome",
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
      ).rejects.toEqual(new Error(`import_report_record_failed:${status}`));
    },
  );

  it.each([
    {
      name: "a poisoned ok getter",
      response: Object.defineProperty(
        {
          status: 201,
          json: async () => ({
            job_id: "123e4567-e89b-42d3-a456-426614174000",
            status: "recorded",
          }),
        },
        "ok",
        {
          get() {
            throw new Error("ok-getter-canary");
          },
        },
      ),
      expected: "import_report_record_failed:201",
    },
    {
      name: "a poisoned status getter",
      response: Object.defineProperty(
        {
          ok: true,
          json: async () => ({
            job_id: "123e4567-e89b-42d3-a456-426614174000",
            status: "recorded",
          }),
        },
        "status",
        {
          get() {
            throw new Error("status-getter-canary");
          },
        },
      ),
      expected: "import_report_record_failed:unknown",
    },
    {
      name: "a poisoned json getter",
      response: Object.defineProperty(
        { ok: true, status: 201 },
        "json",
        {
          get() {
            throw new Error("json-getter-canary");
          },
        },
      ),
      expected: "import_report_record_failed:201",
    },
    {
      name: "a status coercion canary",
      response: {
        ok: false,
        status: {
          [Symbol.toPrimitive]() {
            throw new Error("status-coercion-canary");
          },
          toString() {
            throw new Error("status-to-string-canary");
          },
          valueOf() {
            throw new Error("status-value-of-canary");
          },
        },
        json: async () => ({ ok: false, error: "invalid_token" }),
      },
      expected: "import_report_record_failed:unknown",
    },
  ])("fails closed for $name", async ({ response, expected }) => {
    const fetcher = vi.fn().mockResolvedValue(response);

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
        source: "chrome",
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
    ).rejects.toEqual(new Error(expected));
  });

  it.each([
    {
      name: "a poisoned receipt getter",
      ok: true,
      payload: Object.defineProperty({ status: "recorded" }, "job_id", {
        enumerable: true,
        get() {
          throw new Error("receipt-getter-canary");
        },
      }),
      expected: "import_report_record_failed:201",
    },
    {
      name: "a poisoned error proxy",
      ok: false,
      payload: new Proxy(
        { ok: false, error: "invalid_token" },
        {
          getPrototypeOf() {
            throw new Error("error-proxy-canary");
          },
        },
      ),
      expected: "import_report_record_failed:401",
    },
  ])("does not surface a canary from $name", async ({ ok, payload, expected }) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok,
      status: ok ? 201 : 401,
      json: async () => payload,
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
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
    ).rejects.toEqual(new Error(expected));
  });

  it("does not surface a stateful allowlisted error getter", async () => {
    const errorCanary = "STATEFUL_ERROR_CANARY";
    let reads = 0;
    const payload = Object.defineProperty({ ok: false }, "error", {
      enumerable: true,
      get() {
        reads += 1;
        return reads <= 3 ? "invalid_token" : errorCanary;
      },
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => payload,
    });

    let failure: unknown;
    try {
      await recordBrowserImportReport(fetcher, "jwt-token", {
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
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toEqual(new Error("import_report_record_failed:401"));
    expect(String(failure)).not.toContain(errorCanary);
  });

  it("does not return a stateful receipt job id getter", async () => {
    const jobCanary = "STATEFUL_JOB_CANARY";
    const validJobId = "123e4567-e89b-42d3-a456-426614174000";
    let reads = 0;
    const payload = Object.defineProperty({ status: "recorded" }, "job_id", {
      enumerable: true,
      get() {
        reads += 1;
        return reads <= 2 ? validJobId : jobCanary;
      },
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => payload,
    });

    let failure: unknown;
    try {
      await recordBrowserImportReport(fetcher, "jwt-token", {
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
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toEqual(new Error("import_report_record_failed:201"));
    expect(String(failure)).not.toContain(jobCanary);
  });

  it.each([
    {
      name: "a receipt job_id getter that returns a valid value",
      ok: true,
      status: 201,
      payload: Object.defineProperty({ status: "recorded" }, "job_id", {
        enumerable: true,
        get: () => "123e4567-e89b-42d3-a456-426614174000",
      }),
    },
    {
      name: "a receipt status getter that returns a valid value",
      ok: true,
      status: 201,
      payload: Object.defineProperty(
        { job_id: "123e4567-e89b-42d3-a456-426614174000" },
        "status",
        { enumerable: true, get: () => "recorded" },
      ),
    },
    {
      name: "multiple receipt getters that return valid values",
      ok: true,
      status: 201,
      payload: Object.defineProperties({}, {
        job_id: {
          enumerable: true,
          get: () => "123e4567-e89b-42d3-a456-426614174000",
        },
        status: { enumerable: true, get: () => "recorded" },
      }),
    },
    {
      name: "an error ok getter that returns false",
      ok: false,
      status: 401,
      payload: Object.defineProperty({ error: "invalid_token" }, "ok", {
        enumerable: true,
        get: () => false,
      }),
    },
    {
      name: "an error getter that returns an allowlisted value",
      ok: false,
      status: 401,
      payload: Object.defineProperty({ ok: false }, "error", {
        enumerable: true,
        get: () => "invalid_token",
      }),
    },
    {
      name: "multiple error getters that return valid values",
      ok: false,
      status: 401,
      payload: Object.defineProperties({}, {
        ok: { enumerable: true, get: () => false },
        error: { enumerable: true, get: () => "invalid_token" },
      }),
    },
    {
      name: "a receipt setter-only job_id field",
      ok: true,
      status: 201,
      payload: Object.defineProperty({ status: "recorded" }, "job_id", {
        enumerable: true,
        set: () => undefined,
      }),
    },
    {
      name: "a receipt setter-only status field",
      ok: true,
      status: 201,
      payload: Object.defineProperty(
        { job_id: "123e4567-e89b-42d3-a456-426614174000" },
        "status",
        { enumerable: true, set: () => undefined },
      ),
    },
    {
      name: "an error setter-only error field",
      ok: false,
      status: 401,
      payload: Object.defineProperty({ ok: false }, "error", {
        enumerable: true,
        set: () => undefined,
      }),
    },
    {
      name: "a receipt proxy with an ownKeys trap",
      ok: true,
      status: 201,
      payload: new Proxy(
        {
          job_id: "123e4567-e89b-42d3-a456-426614174000",
          status: "recorded",
        },
        {
          ownKeys() {
            throw new Error("receipt-own-keys-canary");
          },
        },
      ),
    },
    {
      name: "an error proxy with a descriptor trap",
      ok: false,
      status: 401,
      payload: new Proxy(
        { ok: false, error: "invalid_token" },
        {
          getOwnPropertyDescriptor() {
            throw new Error("error-descriptor-canary");
          },
        },
      ),
    },
  ])("rejects $name", async ({ ok, status, payload }) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => payload,
    });

    await expect(
      recordBrowserImportReport(fetcher, "jwt-token", {
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
    ).rejects.toEqual(new Error(`import_report_record_failed:${status}`));
  });
});
