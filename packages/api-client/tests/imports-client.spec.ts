import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  recordBrowserImportReport,
  toBrowserImportReportRequest,
  type BrowserImportRowReasonCode,
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

  it("posts a sanitized browser import report with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ job_id: "job-1", status: "recorded" }),
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

    expect(response).toEqual({ job_id: "job-1", status: "recorded" });
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

  it.each([
    "invalid_import_report",
    "missing_bearer_token",
    "invalid_token",
    "profile_not_found",
    "import_report_too_large",
    "unsupported_media_type",
    "import_report_create_failed",
  ] as const)("surfaces the allowlisted contract error %s", async (error) => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error }),
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
    ).rejects.toThrow(error);
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
});
