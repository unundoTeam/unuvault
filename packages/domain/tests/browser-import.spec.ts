import { describe, expect, it } from "vitest";
import {
  analyzeBrowserImport,
  BROWSER_IMPORT_LIMITS,
  BrowserImportError,
  type BrowserImportErrorCode,
} from "../src/browser-import";

function expectBrowserImportError(
  action: () => unknown,
  code: BrowserImportErrorCode,
) {
  let caughtError: unknown;
  try {
    action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(BrowserImportError);
  expect(caughtError).toMatchObject({
    name: "BrowserImportError",
    code,
  });
}

describe("analyzeBrowserImport", () => {
  it("accepts a minimal Chrome password CSV row", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "name,url,username,password,note",
        "GitHub,https://github.com/login,alice,correct horse,",
      ].join("\n"),
    });

    expect(result).toEqual({
      acceptedEntries: [
        {
          rowIndex: 2,
          source: "chrome",
          name: "GitHub",
          websiteOrigin: "https://github.com",
          username: "alice",
          password: "correct horse",
        },
      ],
      report: {
        counts: {
          totalRows: 1,
          acceptedRows: 1,
          malformedRows: 0,
          duplicateRows: 0,
        },
        issues: [],
      },
    });
  });

  it("parses BOM-prefixed RFC 4180 quoted fields", () => {
    const result = analyzeBrowserImport({
      source: "edge",
      csv:
        '\uFEFFname,url,username,password,note,extra\r\n' +
        '"Work, \"\"Primary\"\"",https://example.com/login,alice,"p,a,s,s",,"line one\r\nline two"',
    });

    expect(result.acceptedEntries).toEqual([
      {
        rowIndex: 2,
        source: "edge",
        name: 'Work, "Primary"',
        websiteOrigin: "https://example.com",
        username: "alice",
        password: "p,a,s,s",
      },
    ]);
  });

  it("accepts a password-only row with an empty username", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: "url,username,password\nhttps://example.com,,secret-only",
    });

    expect(result.acceptedEntries[0]?.username).toBe("");
    expect(result.report.counts.acceptedRows).toBe(1);
  });

  it("reports a non-empty note without accepting the row", () => {
    const note = "private recovery note";
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: `url,username,password,note\nhttps://example.com,alice,secret,${note}`,
    });

    expect(result).toEqual({
      acceptedEntries: [],
      report: {
        counts: {
          totalRows: 1,
          acceptedRows: 0,
          malformedRows: 1,
          duplicateRows: 0,
        },
        issues: [{ rowIndex: 2, reasonCode: "unsupported_note" }],
      },
    });
    expect(JSON.stringify(result.report)).not.toContain(note);
  });

  it("rejects an unsupported source with a sanitized stable error", () => {
    const csv = "url,username,password\nhttps://example.com,alice,secret";

    expectBrowserImportError(
      () => analyzeBrowserImport({ source: "safari" as "chrome", csv }),
      "unsupported_source",
    );
    expectBrowserImportError(
      () => analyzeBrowserImport({ source: "unknown" as "chrome", csv }),
      "unsupported_source",
    );
  });

  it("rejects an empty CSV with a stable error", () => {
    expectBrowserImportError(
      () => analyzeBrowserImport({ source: "chrome", csv: "\uFEFF" }),
      "empty_csv",
    );
  });

  it("rejects a CSV missing a required header", () => {
    expectBrowserImportError(
      () =>
        analyzeBrowserImport({
          source: "chrome",
          csv: "name,url,password\nGitHub,https://github.com,secret",
        }),
      "missing_required_header",
    );
  });

  it("normalizes header names and ignores unknown columns", () => {
    const result = analyzeBrowserImport({
      source: "edge",
      csv: [
        " URL , USERNAME , Password ,folder",
        "https://example.com/path,alice,secret,work",
      ].join("\n"),
    });

    expect(result.acceptedEntries).toEqual([
      {
        rowIndex: 2,
        source: "edge",
        name: "",
        websiteOrigin: "https://example.com",
        username: "alice",
        password: "secret",
      },
    ]);
  });

  it("rejects duplicate normalized headers", () => {
    expectBrowserImportError(
      () =>
        analyzeBrowserImport({
          source: "chrome",
          csv: "url,username,password, URL \nhttps://example.com,alice,secret,ignored",
        }),
      "duplicate_header",
    );
  });

  it("lowercases ASCII headers without folding unknown Unicode headers", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "URL,USERNAME,PASSWORD,Ä,ä",
        "https://example.com,alice,secret,ignored,ignored",
      ].join("\n"),
    });

    expect(result.report.counts.acceptedRows).toBe(1);
  });

  it("accepts exactly 256 header columns", () => {
    const headerColumns = [
      "url",
      "username",
      "password",
      ...Array.from({ length: 253 }, (_, index) => `extra_${index}`),
    ];
    const result = analyzeBrowserImport({
      source: "edge",
      csv: [
        headerColumns.join(","),
        "https://example.com,alice,secret",
      ].join("\n"),
    });

    expect(BROWSER_IMPORT_LIMITS.headerColumns).toBe(256);
    expect(result.report.counts.acceptedRows).toBe(1);
  });

  it("stops parsing as soon as the header-column ceiling is exceeded", () => {
    const headerColumns = [
      "url",
      "username",
      "password",
      ...Array.from({ length: 10_000 }, (_, index) => `extra_${index}`),
    ];
    const csv = [headerColumns.join(","), '"unterminated after header'].join(
      "\n",
    );

    expectBrowserImportError(
      () => analyzeBrowserImport({ source: "chrome", csv }),
      "too_many_columns",
    );
  });

  it("analyzes multiple bare-CR rows without counting a trailing delimiter", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv:
        "url,username,password\r" +
        "https://one.example/path,one,secret-one\r" +
        "https://two.example/path,two,secret-two\r",
    });

    expect(result.acceptedEntries.map(({ rowIndex, websiteOrigin }) => ({
      rowIndex,
      websiteOrigin,
    }))).toEqual([
      { rowIndex: 2, websiteOrigin: "https://one.example" },
      { rowIndex: 3, websiteOrigin: "https://two.example" },
    ]);
    expect(result.report.counts).toEqual({
      totalRows: 2,
      acceptedRows: 2,
      malformedRows: 0,
      duplicateRows: 0,
    });
  });

  it("reports an empty logical row and continues with later rows", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "url,username,password",
        "",
        "https://example.com,alice,secret",
      ].join("\n"),
    });

    expect(result.acceptedEntries).toHaveLength(1);
    expect(result.acceptedEntries[0]?.rowIndex).toBe(3);
    expect(result.report).toEqual({
      counts: {
        totalRows: 2,
        acceptedRows: 1,
        malformedRows: 1,
        duplicateRows: 0,
      },
      issues: [{ rowIndex: 2, reasonCode: "empty_row" }],
    });
  });

  it("reports a row with more fields than its header as malformed", () => {
    const result = analyzeBrowserImport({
      source: "edge",
      csv: "url,username,password\nhttps://example.com,alice,secret,unexpected",
    });

    expect(result.acceptedEntries).toEqual([]);
    expect(result.report.issues).toEqual([
      { rowIndex: 2, reasonCode: "malformed_row" },
    ]);
  });

  it.each([
    {
      row: ",alice,secret",
      reasonCode: "empty_url",
    },
    {
      row: "https://example.com,alice,",
      reasonCode: "empty_password",
    },
  ] as const)("reports $reasonCode without accepting the row", ({ row, reasonCode }) => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: `url,username,password\n${row}`,
    });

    expect(result.acceptedEntries).toEqual([]);
    expect(result.report.issues).toEqual([{ rowIndex: 2, reasonCode }]);
  });

  it.each([
    {
      field: "url",
      reasonCode: "url_too_long",
      value: () => {
        const prefix = "https://example.com/";
        return prefix + "a".repeat(BROWSER_IMPORT_LIMITS.urlBytes + 1 - prefix.length);
      },
    },
    {
      field: "username",
      reasonCode: "username_too_long",
      value: () => "a".repeat(BROWSER_IMPORT_LIMITS.usernameBytes + 1),
    },
    {
      field: "password",
      reasonCode: "password_too_long",
      value: () => "a".repeat(BROWSER_IMPORT_LIMITS.passwordBytes + 1),
    },
    {
      field: "name",
      reasonCode: "name_too_long",
      value: () => "a".repeat(BROWSER_IMPORT_LIMITS.nameBytes + 1),
    },
  ] as const)("reports $reasonCode for an oversized $field", ({ field, reasonCode, value }) => {
    const fields = {
      name: "Example",
      url: "https://example.com",
      username: "alice",
      password: "secret",
    };
    fields[field] = value();
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: `name,url,username,password\n${fields.name},${fields.url},${fields.username},${fields.password}`,
    });

    expect(result.acceptedEntries).toEqual([]);
    expect(result.report.issues).toEqual([{ rowIndex: 2, reasonCode }]);
  });

  it.each([
    {
      field: "url",
      reasonCode: "url_too_long",
      value: () =>
        " ".repeat(BROWSER_IMPORT_LIMITS.urlBytes) + "https://example.com",
    },
    {
      field: "username",
      reasonCode: "username_too_long",
      value: () => " ".repeat(BROWSER_IMPORT_LIMITS.usernameBytes) + "alice",
    },
    {
      field: "name",
      reasonCode: "name_too_long",
      value: () => " ".repeat(BROWSER_IMPORT_LIMITS.nameBytes) + "Example",
    },
  ] as const)(
    "applies the raw UTF-8 cap before trimming an oversized $field",
    ({ field, reasonCode, value }) => {
      const fields = {
        name: "Example",
        url: "https://example.com",
        username: "alice",
        password: "secret",
      };
      fields[field] = value();
      const result = analyzeBrowserImport({
        source: "edge",
        csv: `name,url,username,password\n${fields.name},${fields.url},${fields.username},${fields.password}`,
      });

      expect(result.acceptedEntries).toEqual([]);
      expect(result.report.issues).toEqual([{ rowIndex: 2, reasonCode }]);
    },
  );

  it("accepts an exact multibyte field cap and rejects the next byte", () => {
    const exactUsername = "é".repeat(BROWSER_IMPORT_LIMITS.usernameBytes / 2);
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "url,username,password",
        `https://one.example,${exactUsername},secret-one`,
        `https://two.example,${exactUsername}a,secret-two`,
      ].join("\n"),
    });

    expect(result.acceptedEntries.map(({ rowIndex, username }) => ({
      rowIndex,
      username,
    }))).toEqual([{ rowIndex: 2, username: exactUsername }]);
    expect(result.report.issues).toEqual([
      { rowIndex: 3, reasonCode: "username_too_long" },
    ]);
  });

  it("normalizes origins and trims non-secret identity fields", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv:
        "name,url,username,password\n" +
        "  Example  ,  https://user:pass@EXAMPLE.com:443/path?token=value#fragment  ,  e\u0301  , secret ",
    });

    expect(result.acceptedEntries).toEqual([
      {
        rowIndex: 2,
        source: "chrome",
        name: "Example",
        websiteOrigin: "https://example.com",
        username: "é",
        password: " secret ",
      },
    ]);
  });

  it.each([
    { url: "not a url", reasonCode: "invalid_url" },
    { url: "ftp://example.com/file", reasonCode: "unsupported_url_scheme" },
  ] as const)("reports $reasonCode for $url", ({ url, reasonCode }) => {
    const result = analyzeBrowserImport({
      source: "edge",
      csv: `url,username,password\n${url},alice,secret`,
    });

    expect(result.acceptedEntries).toEqual([]);
    expect(result.report.issues).toEqual([{ rowIndex: 2, reasonCode }]);
  });

  it("keeps the first origin-and-username key and reports later duplicates", () => {
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "url,username,password",
        "https://example.com/first, alice ,secret-one",
        "https://EXAMPLE.com:443/second,alice,secret-two",
        "https://example.com/third,ALICE,secret-three",
      ].join("\n"),
    });

    expect(result.acceptedEntries.map(({ rowIndex, username }) => ({
      rowIndex,
      username,
    }))).toEqual([
      { rowIndex: 2, username: "alice" },
      { rowIndex: 4, username: "ALICE" },
    ]);
    expect(result.report).toEqual({
      counts: {
        totalRows: 3,
        acceptedRows: 2,
        malformedRows: 0,
        duplicateRows: 1,
      },
      issues: [
        {
          rowIndex: 3,
          reasonCode: "duplicate",
          duplicateOfRowIndex: 2,
        },
      ],
    });
  });

  it("rejects a CSV larger than 10 MiB before parsing", () => {
    const oversizedCsv = "a".repeat(BROWSER_IMPORT_LIMITS.csvBytes + 1);

    expectBrowserImportError(
      () => analyzeBrowserImport({ source: "chrome", csv: oversizedCsv }),
      "file_too_large",
    );
  });

  it("rejects more than 3,000 data rows before classification", () => {
    const rows = Array.from(
      { length: BROWSER_IMPORT_LIMITS.dataRows + 1 },
      (_, index) => `https://example-${index}.com,user-${index},secret`,
    );

    expectBrowserImportError(
      () =>
        analyzeBrowserImport({
          source: "edge",
          csv: ["url,username,password", ...rows].join("\n"),
        }),
      "too_many_rows",
    );
  });

  it("accepts exactly 3,000 data rows", () => {
    const rows = Array.from(
      { length: BROWSER_IMPORT_LIMITS.dataRows },
      (_, index) => `https://example-${index}.com,user-${index},secret`,
    );
    const result = analyzeBrowserImport({
      source: "edge",
      csv: ["url,username,password", ...rows].join("\n"),
    });

    expect(result.report.counts).toEqual({
      totalRows: BROWSER_IMPORT_LIMITS.dataRows,
      acceptedRows: BROWSER_IMPORT_LIMITS.dataRows,
      malformedRows: 0,
      duplicateRows: 0,
    });
  });

  it("stops parsing as soon as the data-row limit is exceeded", () => {
    const rows = Array.from(
      { length: BROWSER_IMPORT_LIMITS.dataRows + 1 },
      (_, index) => `https://example-${index}.com,user-${index},secret`,
    );
    const csv = [
      "url,username,password",
      ...rows,
      '"unterminated credential after the limit',
    ].join("\n");

    expectBrowserImportError(
      () => analyzeBrowserImport({ source: "chrome", csv }),
      "too_many_rows",
    );
  });

  it.each([
    'url,username,password\n"https://example.com,alice,secret',
    'url,username,password\nhttps://exa"mple.com,alice,secret',
    'url,username,password\n"https://example.com"suffix,alice,secret',
  ])("rejects malformed CSV syntax without echoing it", (csv) => {
    try {
      analyzeBrowserImport({ source: "chrome", csv });
      throw new Error("expected analyzeBrowserImport to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserImportError);
      expect(error).toMatchObject({ code: "malformed_csv" });
      expect(String(error)).not.toContain("example.com");
    }
  });

  it("keeps reports free of browser-export values", () => {
    const secrets = {
      url: "https://private.example/path",
      username: "private-user",
      password: "private-password",
      name: "Private Name",
      note: "Private Note",
    };
    const result = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "name,url,username,password,note",
        [
          secrets.name,
          secrets.url,
          secrets.username,
          secrets.password,
          secrets.note,
        ].join(","),
      ].join("\n"),
    });
    const serializedReport = JSON.stringify(result.report);

    expect(Object.keys(result.report)).toEqual(["counts", "issues"]);
    expect(Object.keys(result.report.issues[0] ?? {})).toEqual([
      "rowIndex",
      "reasonCode",
    ]);
    for (const value of Object.values(secrets)) {
      expect(serializedReport).not.toContain(value);
    }
  });
});
