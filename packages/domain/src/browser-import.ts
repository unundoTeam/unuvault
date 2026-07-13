export type BrowserImportSource = "chrome" | "edge";

export const BROWSER_IMPORT_LIMITS = {
  csvBytes: 10 * 1024 * 1024,
  dataRows: 3_000,
  headerColumns: 256,
  urlBytes: 8 * 1024,
  usernameBytes: 4 * 1024,
  passwordBytes: 16 * 1024,
  nameBytes: 4 * 1024,
} as const;

const textEncoder = new TextEncoder();

function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

export type BrowserImportErrorCode =
  | "unsupported_source"
  | "file_too_large"
  | "empty_csv"
  | "malformed_csv"
  | "missing_required_header"
  | "duplicate_header"
  | "too_many_columns"
  | "too_many_rows";

export class BrowserImportError extends Error {
  readonly code: BrowserImportErrorCode;

  constructor(code: BrowserImportErrorCode) {
    super(code);
    this.name = "BrowserImportError";
    this.code = code;
  }
}

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

export type BrowserImportIssue =
  | {
      rowIndex: number;
      reasonCode: Exclude<BrowserImportRowReasonCode, "duplicate">;
    }
  | {
      rowIndex: number;
      reasonCode: "duplicate";
      duplicateOfRowIndex: number;
    };

export type BrowserImportAcceptedEntry = {
  rowIndex: number;
  source: BrowserImportSource;
  name: string;
  websiteOrigin: string;
  username: string;
  password: string;
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

export type BrowserImportAnalysis = {
  acceptedEntries: BrowserImportAcceptedEntry[];
  report: BrowserImportReport;
};

type ParsedCsvRecord = {
  values: string[];
  hasExtraFields: boolean;
  discardedFieldHasContent: boolean;
};

function parseCsv(
  input: string,
  maxDataRows: number,
  maxHeaderColumns: number,
): ParsedCsvRecord[] {
  const rows: ParsedCsvRecord[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let justClosedQuote = false;
  let fieldHasUnquotedContent = false;
  let hasExtraFields = false;
  let discardedFieldHasContent = false;

  function capturesCurrentField() {
    const headerLength = rows[0]?.values.length;
    return headerLength === undefined || row.length < headerLength;
  }

  function appendFieldCharacter(character: string) {
    if (capturesCurrentField()) {
      field += character;
    } else {
      discardedFieldHasContent = true;
    }
  }

  function finishField() {
    if (rows.length === 0 && row.length >= maxHeaderColumns) {
      throw new BrowserImportError("too_many_columns");
    }
    if (capturesCurrentField()) {
      row.push(field);
    } else {
      hasExtraFields = true;
      discardedFieldHasContent ||= field.length > 0;
    }
    field = "";
    justClosedQuote = false;
    fieldHasUnquotedContent = false;
  }

  function finishRow() {
    finishField();
    rows.push({ values: row, hasExtraFields, discardedFieldHasContent });
    row = [];
    hasExtraFields = false;
    discardedFieldHasContent = false;
    if (rows.length - 1 > maxDataRows) {
      throw new BrowserImportError("too_many_rows");
    }
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          appendFieldCharacter('"');
          index += 1;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else {
        appendFieldCharacter(character);
      }
      continue;
    }

    if (justClosedQuote) {
      if (character === ",") {
        finishField();
        continue;
      }
      if (character === "\n" || character === "\r") {
        finishRow();
        if (character === "\r" && input[index + 1] === "\n") {
          index += 1;
        }
        continue;
      }
      throw new BrowserImportError("malformed_csv");
    }

    if (character === '"') {
      if (fieldHasUnquotedContent) {
        throw new BrowserImportError("malformed_csv");
      }
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      finishField();
      continue;
    }
    if (character === "\n" || character === "\r") {
      finishRow();
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }
    appendFieldCharacter(character);
    fieldHasUnquotedContent = true;
  }

  if (inQuotes) {
    throw new BrowserImportError("malformed_csv");
  }
  if (
    field.length > 0 ||
    fieldHasUnquotedContent ||
    row.length > 0 ||
    hasExtraFields ||
    justClosedQuote
  ) {
    finishRow();
  }

  return rows;
}

export function analyzeBrowserImport(input: {
  source: string;
  csv: string;
}): BrowserImportAnalysis {
  if (input.source !== "chrome" && input.source !== "edge") {
    throw new BrowserImportError("unsupported_source");
  }
  if (utf8ByteLength(input.csv) > BROWSER_IMPORT_LIMITS.csvBytes) {
    throw new BrowserImportError("file_too_large");
  }
  const source: BrowserImportSource = input.source;
  const csv = input.csv.startsWith("\uFEFF") ? input.csv.slice(1) : input.csv;
  if (csv.length === 0) {
    throw new BrowserImportError("empty_csv");
  }
  const [headerRecord, ...dataRows] = parseCsv(
    csv,
    BROWSER_IMPORT_LIMITS.dataRows,
    BROWSER_IMPORT_LIMITS.headerColumns,
  );
  const rawHeaders = headerRecord?.values ?? [];
  if (dataRows.length > BROWSER_IMPORT_LIMITS.dataRows) {
    throw new BrowserImportError("too_many_rows");
  }
  const headers = rawHeaders.map((header) =>
    header.trim().replace(/[A-Z]/g, (character) => character.toLowerCase()),
  );
  if (new Set(headers).size !== headers.length) {
    throw new BrowserImportError("duplicate_header");
  }
  if (!["url", "username", "password"].every((header) => headers.includes(header))) {
    throw new BrowserImportError("missing_required_header");
  }
  const acceptedEntries: BrowserImportAcceptedEntry[] = [];
  const issues: BrowserImportIssue[] = [];
  const firstRowByDuplicateKey = new Map<string, number>();

  dataRows.forEach((record, dataIndex) => {
    const { values } = record;
    const rowIndex = dataIndex + 2;
    const valueFor = (header: string) => values[headers.indexOf(header)] ?? "";
    const rawUrl = valueFor("url");
    const rawUsername = valueFor("username");
    const password = valueFor("password");
    const rawName = valueFor("name");
    const note = valueFor("note");
    const url = rawUrl.trim();
    const username = rawUsername.trim().normalize("NFC");
    const name = rawName.trim();

    if (
      values.every((value) => value.length === 0) &&
      !record.discardedFieldHasContent
    ) {
      issues.push({ rowIndex, reasonCode: "empty_row" });
      return;
    }

    if (record.hasExtraFields) {
      issues.push({ rowIndex, reasonCode: "malformed_row" });
      return;
    }

    if (url.length === 0) {
      issues.push({ rowIndex, reasonCode: "empty_url" });
      return;
    }

    if (password.length === 0) {
      issues.push({ rowIndex, reasonCode: "empty_password" });
      return;
    }

    if (
      utf8ByteLength(rawUrl) > BROWSER_IMPORT_LIMITS.urlBytes ||
      utf8ByteLength(url) > BROWSER_IMPORT_LIMITS.urlBytes
    ) {
      issues.push({ rowIndex, reasonCode: "url_too_long" });
      return;
    }

    if (
      utf8ByteLength(rawUsername) > BROWSER_IMPORT_LIMITS.usernameBytes ||
      utf8ByteLength(username) > BROWSER_IMPORT_LIMITS.usernameBytes
    ) {
      issues.push({ rowIndex, reasonCode: "username_too_long" });
      return;
    }

    if (utf8ByteLength(password) > BROWSER_IMPORT_LIMITS.passwordBytes) {
      issues.push({ rowIndex, reasonCode: "password_too_long" });
      return;
    }

    if (
      utf8ByteLength(rawName) > BROWSER_IMPORT_LIMITS.nameBytes ||
      utf8ByteLength(name) > BROWSER_IMPORT_LIMITS.nameBytes
    ) {
      issues.push({ rowIndex, reasonCode: "name_too_long" });
      return;
    }

    if (note.length > 0) {
      issues.push({ rowIndex, reasonCode: "unsupported_note" });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      issues.push({ rowIndex, reasonCode: "invalid_url" });
      return;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      issues.push({ rowIndex, reasonCode: "unsupported_url_scheme" });
      return;
    }

    const duplicateKey = `${parsedUrl.origin}\u0000${username}`;
    const duplicateOfRowIndex = firstRowByDuplicateKey.get(duplicateKey);
    if (duplicateOfRowIndex !== undefined) {
      issues.push({
        rowIndex,
        reasonCode: "duplicate",
        duplicateOfRowIndex,
      });
      return;
    }

    acceptedEntries.push({
      rowIndex,
      source,
      name,
      websiteOrigin: parsedUrl.origin,
      username,
      password,
    });
    firstRowByDuplicateKey.set(duplicateKey, rowIndex);
  });

  const duplicateRows = issues.filter(
    (issue) => issue.reasonCode === "duplicate",
  ).length;

  return {
    acceptedEntries,
    report: {
      counts: {
        totalRows: dataRows.length,
        acceptedRows: acceptedEntries.length,
        malformedRows: issues.length - duplicateRows,
        duplicateRows,
      },
      issues,
    },
  };
}
