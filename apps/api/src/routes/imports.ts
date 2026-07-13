import type {
  FastifyError,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { BrowserImportReportReceiptResponse } from "../../../../packages/api-client/src/imports";
import { readStrictBearerToken } from "../lib/bearer-token";
import { createConfiguredImportReportService } from "../lib/supabase";
import {
  ImportReportProfileNotFoundError,
  ImportReportUnauthorizedError,
  ImportReportValidationError,
} from "../services/import-service";

const IMPORT_REPORT_BODY_LIMIT = 512 * 1024;

export type ImportRouteDependencies = {
  recordBrowserImportReport(
    token: string,
    input: unknown,
  ): Promise<BrowserImportReportReceiptResponse>;
};

function hasJsonContentType(request: FastifyRequest): boolean {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string") {
    return false;
  }

  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function sendStaticError(
  reply: FastifyReply,
  statusCode: 400 | 401 | 404 | 413 | 415 | 500,
  error: string,
): void {
  void reply.code(statusCode).send({ ok: false, error });
}

function mapImportRouteParseError(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    sendStaticError(reply, 413, "import_report_too_large");
    return;
  }
  if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
    sendStaticError(reply, 415, "unsupported_media_type");
    return;
  }
  if (error.statusCode === 400) {
    sendStaticError(reply, 400, "invalid_import_report");
    return;
  }

  sendStaticError(reply, 500, "import_report_create_failed");
}

function mapStableImportError(error: unknown, reply: FastifyReply): void {
  if (error instanceof ImportReportValidationError) {
    sendStaticError(reply, 400, "invalid_import_report");
    return;
  }
  if (error instanceof ImportReportUnauthorizedError) {
    sendStaticError(reply, 401, "invalid_token");
    return;
  }
  if (error instanceof ImportReportProfileNotFoundError) {
    sendStaticError(reply, 404, "profile_not_found");
    return;
  }

  sendStaticError(reply, 500, "import_report_create_failed");
}

export function createImportRoutes(
  deps: ImportRouteDependencies,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/", async () => ({ ok: true, scope: "imports" }));

    app.post(
      "/browser",
      {
        bodyLimit: IMPORT_REPORT_BODY_LIMIT,
        errorHandler: mapImportRouteParseError,
      },
      async (request, reply) => {
        const token = readStrictBearerToken(
          request.headers.authorization,
        );
        if (!token) {
          sendStaticError(reply, 401, "missing_bearer_token");
          return;
        }
        if (!hasJsonContentType(request)) {
          sendStaticError(reply, 415, "unsupported_media_type");
          return;
        }

        try {
          const receipt = await deps.recordBrowserImportReport(
            token,
            request.body,
          );
          return reply.code(201).send(receipt);
        } catch (error) {
          mapStableImportError(error, reply);
        }
      },
    );
  };
}

export const importRoutes = createImportRoutes(
  createConfiguredImportReportService(),
);
