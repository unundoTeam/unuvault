import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImportRoutes,
  importRoutes,
  type ImportRouteDependencies,
} from "../src/routes/imports";
import {
  ImportReportProfileNotFoundError,
  ImportReportUnauthorizedError,
  ImportReportValidationError,
} from "../src/services/import-service";

const MAX_BODY_BYTES = 512 * 1024;
const VALID_REQUEST = {
  source: "chrome",
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
const RECEIPT = {
  job_id: "123e4567-e89b-42d3-a456-426614174000",
  status: "recorded" as const,
};

function createDependencies(): ImportRouteDependencies {
  return {
    recordBrowserImportReport: vi.fn().mockResolvedValue(RECEIPT),
  };
}

async function buildImportApp(deps: ImportRouteDependencies) {
  const app = Fastify();
  await app.register(createImportRoutes(deps), { prefix: "/imports" });
  await app.ready();
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /imports/browser", () => {
  it("records a sanitized report through the injected authenticated service", async () => {
    const deps = createDependencies();
    const app = await buildImportApp(deps);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers: { authorization: "Bearer jwt-token" },
        payload: VALID_REQUEST,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(RECEIPT);
      expect(deps.recordBrowserImportReport).toHaveBeenCalledTimes(1);
      expect(deps.recordBrowserImportReport).toHaveBeenCalledWith(
        "jwt-token",
        VALID_REQUEST,
      );
    } finally {
      await app.close();
    }
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["wrong scheme", "Basic jwt-token"],
    ["leading whitespace", " Bearer jwt-token"],
    ["trailing whitespace", "Bearer jwt-token "],
    ["double space", "Bearer  jwt-token"],
    ["control character", "Bearer jwt-token\tjunk"],
    ["extra segment", "Bearer jwt-token extra"],
  ])("rejects a %s authorization header", async (_label, authorization) => {
    const deps = createDependencies();
    const app = await buildImportApp(deps);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers:
          authorization === undefined ? undefined : { authorization },
        payload: VALID_REQUEST,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        ok: false,
        error: "missing_bearer_token",
      });
      expect(deps.recordBrowserImportReport).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([
    [
      new ImportReportUnauthorizedError(),
      401,
      "invalid_token",
    ],
    [
      new ImportReportProfileNotFoundError(),
      404,
      "profile_not_found",
    ],
    [
      new ImportReportValidationError(),
      400,
      "invalid_import_report",
    ],
  ])(
    "maps stable service errors without exposing details",
    async (serviceError, statusCode, errorCode) => {
      const deps = createDependencies();
      vi.mocked(deps.recordBrowserImportReport).mockRejectedValue(serviceError);
      const app = await buildImportApp(deps);

      try {
        const response = await app.inject({
          method: "POST",
          url: "/imports/browser",
          headers: { authorization: "Bearer jwt-token" },
          payload: VALID_REQUEST,
        });

        expect(response.statusCode).toBe(statusCode);
        expect(response.json()).toEqual({ ok: false, error: errorCode });
      } finally {
        await app.close();
      }
    },
  );

  it("maps unexpected service failures to a static error without logging request content", async () => {
    const bodyCanary = "RAW_PASSWORD_CANARY";
    const dependencyCanary = "DATABASE_SECRET_CANARY";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const deps = createDependencies();
    vi.mocked(deps.recordBrowserImportReport).mockRejectedValue(
      new Error(dependencyCanary),
    );
    const app = await buildImportApp(deps);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers: { authorization: "Bearer jwt-token" },
        payload: { ...VALID_REQUEST, raw_csv: bodyCanary },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        ok: false,
        error: "import_report_create_failed",
      });
      expect(response.body).not.toContain(bodyCanary);
      expect(response.body).not.toContain(dependencyCanary);
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(bodyCanary);
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(bodyCanary);
    } finally {
      await app.close();
    }
  });

  it("maps malformed JSON to the static validation error", async () => {
    const deps = createDependencies();
    const app = await buildImportApp(deps);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers: {
          authorization: "Bearer jwt-token",
          "content-type": "application/json",
        },
        payload: '{"source":',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        ok: false,
        error: "invalid_import_report",
      });
      expect(deps.recordBrowserImportReport).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("accepts exactly 512 KiB at the parser boundary", async () => {
    const deps = createDependencies();
    const app = await buildImportApp(deps);
    const payload = JSON.stringify("a".repeat(MAX_BODY_BYTES - 2));
    expect(Buffer.byteLength(payload)).toBe(MAX_BODY_BYTES);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers: {
          authorization: "Bearer jwt-token",
          "content-type": "application/json",
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      expect(deps.recordBrowserImportReport).toHaveBeenCalledWith(
        "jwt-token",
        expect.any(String),
      );
    } finally {
      await app.close();
    }
  });

  it("rejects one byte over 512 KiB with a static size error", async () => {
    const deps = createDependencies();
    const app = await buildImportApp(deps);
    const payload = JSON.stringify("a".repeat(MAX_BODY_BYTES - 1));
    expect(Buffer.byteLength(payload)).toBe(MAX_BODY_BYTES + 1);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers: {
          authorization: "Bearer jwt-token",
          "content-type": "application/json",
        },
        payload,
      });

      expect(response.statusCode).toBe(413);
      expect(response.json()).toEqual({
        ok: false,
        error: "import_report_too_large",
      });
      expect(deps.recordBrowserImportReport).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each(["text/plain", "application/xml"])(
    "rejects unsupported content type %s",
    async (contentType) => {
      const deps = createDependencies();
      const app = await buildImportApp(deps);

      try {
        const response = await app.inject({
          method: "POST",
          url: "/imports/browser",
          headers: {
            authorization: "Bearer jwt-token",
            "content-type": contentType,
          },
          payload: JSON.stringify(VALID_REQUEST),
        });

        expect(response.statusCode).toBe(415);
        expect(response.json()).toEqual({
          ok: false,
          error: "unsupported_media_type",
        });
        expect(deps.recordBrowserImportReport).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );

  it("rejects a missing content type after bearer authentication", async () => {
    const deps = createDependencies();
    const app = await buildImportApp(deps);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
        headers: { authorization: "Bearer jwt-token" },
      });

      expect(response.statusCode).toBe(415);
      expect(response.json()).toEqual({
        ok: false,
        error: "unsupported_media_type",
      });
      expect(deps.recordBrowserImportReport).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("keeps default service configuration lazy for unauthenticated requests", async () => {
    const app = Fastify();
    await app.register(importRoutes, { prefix: "/imports" });
    await app.ready();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/imports/browser",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        ok: false,
        error: "missing_bearer_token",
      });
    } finally {
      await app.close();
    }
  });
});
