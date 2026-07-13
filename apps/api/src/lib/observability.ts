export const OBSERVABILITY_SCHEMA_VERSION = 1 as const;

export type ObservabilitySignalClass = "api_http_request";

export type ObservabilityMethod =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "PATCH"
  | "POST"
  | "PUT"
  | "OTHER";

export type ObservabilityStatusClass =
  | "1xx"
  | "2xx"
  | "3xx"
  | "4xx"
  | "5xx"
  | "other";

export type ObservabilityLatencyBucket =
  | "under_100ms"
  | "100ms_to_499ms"
  | "500ms_to_1999ms"
  | "2000ms_and_over";

export type ObservabilityEvent = Readonly<{
  schemaVersion: typeof OBSERVABILITY_SCHEMA_VERSION;
  signalClass: ObservabilitySignalClass;
  routeTemplate: string;
  method: ObservabilityMethod;
  statusClass: ObservabilityStatusClass;
  latencyBucket: ObservabilityLatencyBucket;
  requestId: string;
}>;

export type ObservabilitySink = (
  event: ObservabilityEvent,
) => void | Promise<void>;

const OBSERVABILITY_METHODS = new Set<ObservabilityMethod>([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
]);

export const NOOP_OBSERVABILITY_SINK: ObservabilitySink = () => undefined;

export function classifyLatencyBucket(
  latencyMilliseconds: number,
): ObservabilityLatencyBucket {
  if (latencyMilliseconds < 100) {
    return "under_100ms";
  }

  if (latencyMilliseconds < 500) {
    return "100ms_to_499ms";
  }

  if (latencyMilliseconds < 2_000) {
    return "500ms_to_1999ms";
  }

  return "2000ms_and_over";
}

export function normalizeRequestId(requestId: unknown): string {
  if (
    typeof requestId !== "string" ||
    !/^[A-Za-z0-9._:-]{1,64}$/.test(requestId)
  ) {
    return "invalid";
  }

  return requestId;
}

export function createHttpObservabilityEvent(input: {
  routeTemplate: unknown;
  method: unknown;
  statusCode: number;
  latencyMilliseconds: number;
  requestId: unknown;
}): ObservabilityEvent {
  return {
    schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
    signalClass: "api_http_request",
    routeTemplate: normalizeRouteTemplate(input.routeTemplate),
    method: normalizeMethod(input.method),
    statusClass: classifyStatusClass(input.statusCode),
    latencyBucket: classifyLatencyBucket(input.latencyMilliseconds),
    requestId: normalizeRequestId(input.requestId),
  };
}

function normalizeRouteTemplate(routeTemplate: unknown): string {
  if (
    typeof routeTemplate !== "string" ||
    routeTemplate.length === 0 ||
    routeTemplate.length > 256
  ) {
    return "__unmatched__";
  }

  return routeTemplate;
}

function normalizeMethod(method: unknown): ObservabilityMethod {
  if (
    typeof method === "string" &&
    OBSERVABILITY_METHODS.has(method as ObservabilityMethod)
  ) {
    return method as ObservabilityMethod;
  }

  return "OTHER";
}

function classifyStatusClass(statusCode: number): ObservabilityStatusClass {
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return "other";
  }

  return `${Math.floor(statusCode / 100)}xx` as ObservabilityStatusClass;
}
