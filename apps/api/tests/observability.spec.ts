import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import {
  classifyLatencyBucket,
  normalizeRequestId,
  type ObservabilityEvent,
} from "../src/lib/observability";

const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function makeApp(events: ObservabilityEvent[]) {
  const app = buildApp({
    observabilitySink(event) {
      events.push(event);
    },
  });
  apps.push(app);
  return app;
}

describe("API observability contract", () => {
  it("uses fixed latency buckets", () => {
    expect(classifyLatencyBucket(0)).toBe("under_100ms");
    expect(classifyLatencyBucket(99)).toBe("under_100ms");
    expect(classifyLatencyBucket(100)).toBe("100ms_to_499ms");
    expect(classifyLatencyBucket(499)).toBe("100ms_to_499ms");
    expect(classifyLatencyBucket(500)).toBe("500ms_to_1999ms");
    expect(classifyLatencyBucket(1_999)).toBe("500ms_to_1999ms");
    expect(classifyLatencyBucket(2_000)).toBe("2000ms_and_over");
  });

  it("bounds request ids to a safe ASCII contract", () => {
    expect(normalizeRequestId("req-123:abc.def_456")).toBe(
      "req-123:abc.def_456",
    );
    expect(normalizeRequestId("x".repeat(65))).toBe("invalid");
    expect(normalizeRequestId("request id with spaces")).toBe("invalid");
    expect(normalizeRequestId("口令")).toBe("invalid");
    expect(normalizeRequestId(42)).toBe("invalid");
  });

  it.each([
    { path: "/observability-ok", responseCode: 204, statusClass: "2xx" },
    { path: "/observability-bad", responseCode: 422, statusClass: "4xx" },
    { path: "/observability-down", responseCode: 503, statusClass: "5xx" },
  ] as const)(
    "emits one allowlisted completion event for $statusClass",
    async ({ path, responseCode, statusClass }) => {
      const events: ObservabilityEvent[] = [];
      const app = makeApp(events);
      app.get(path, async (_request, reply) => reply.code(responseCode).send());

      const response = await app.inject({ method: "GET", url: path });

      expect(response.statusCode).toBe(responseCode);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        schemaVersion: 1,
        signalClass: "api_http_request",
        routeTemplate: path,
        method: "GET",
        statusClass,
        latencyBucket: expect.any(String),
        requestId: expect.stringMatching(/^[A-Za-z0-9._:-]{1,64}$/),
      });
    },
  );

  it("uses the Fastify route template and excludes request secrets", async () => {
    const events: ObservabilityEvent[] = [];
    const app = makeApp(events);
    app.post("/observability-items/:itemId", async () => ({ ok: true }));

    const response = await app.inject({
      method: "POST",
      url: "/observability-items/raw-item-secret?querySecret=query-canary",
      headers: {
        authorization: "Bearer authorization-canary",
        cookie: "session=cookie-canary",
        "x-bridge-token": "bridge-token-canary",
      },
      payload: {
        password: "password-canary",
        vaultPayload: "vault-payload-canary",
        ciphertext: "ciphertext-canary",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0]?.routeTemplate).toBe("/observability-items/:itemId");

    const serializedEvent = JSON.stringify(events[0]);
    for (const secret of [
      "raw-item-secret",
      "query-canary",
      "authorization-canary",
      "cookie-canary",
      "bridge-token-canary",
      "password-canary",
      "vault-payload-canary",
      "ciphertext-canary",
    ]) {
      expect(serializedEvent).not.toContain(secret);
    }
  });

  it("emits one fixed unmatched-route event without the raw URL", async () => {
    const events: ObservabilityEvent[] = [];
    const app = makeApp(events);

    const response = await app.inject({
      method: "GET",
      url: "/missing/raw-path-canary?secret=query-canary",
    });

    expect(response.statusCode).toBe(404);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      routeTemplate: "__unmatched__",
      method: "GET",
      statusClass: "4xx",
    });
    expect(JSON.stringify(events[0])).not.toContain("raw-path-canary");
    expect(JSON.stringify(events[0])).not.toContain("query-canary");
  });

  it("emits only once for thrown errors and excludes the raw error message", async () => {
    const events: ObservabilityEvent[] = [];
    const app = makeApp(events);
    app.get("/observability-error", async () => {
      throw new Error("raw-error-message-canary");
    });

    const response = await app.inject({
      method: "GET",
      url: "/observability-error",
    });

    expect(response.statusCode).toBe(500);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      routeTemplate: "/observability-error",
      method: "GET",
      statusClass: "5xx",
    });
    expect(JSON.stringify(events[0])).not.toContain("raw-error-message-canary");
  });

  it("waits for the final error response before emitting its completion event", async () => {
    const events: ObservabilityEvent[] = [];
    const app = makeApp(events);
    let markErrorHandlerStarted: () => void = () => undefined;
    const errorHandlerStarted = new Promise<void>((resolve) => {
      markErrorHandlerStarted = resolve;
    });
    let releaseErrorHandler: () => void = () => undefined;
    const errorHandlerGate = new Promise<void>((resolve) => {
      releaseErrorHandler = resolve;
    });

    app.setErrorHandler(async (_error, _request, reply) => {
      markErrorHandlerStarted();
      await errorHandlerGate;
      return reply.code(422).send({ ok: false, error: "mapped_error" });
    });
    app.get("/observability-mapped-error", async () => {
      throw new Error("raw-mapped-error-canary");
    });

    const responsePromise = app.inject({
      method: "GET",
      url: "/observability-mapped-error",
    });
    await errorHandlerStarted;
    const eventsBeforeCompletion = [...events];
    releaseErrorHandler();
    const response = await responsePromise;

    expect(eventsBeforeCompletion).toHaveLength(0);
    expect(response.statusCode).toBe(422);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      routeTemplate: "/observability-mapped-error",
      method: "GET",
      statusClass: "4xx",
    });
    expect(JSON.stringify(events[0])).not.toContain("raw-mapped-error-canary");
  });

  it("does not let a rejected sink break the request", async () => {
    const app = buildApp({
      async observabilitySink() {
        throw new Error("sink unavailable");
      },
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("does not wait for a slow sink before completing an error response", async () => {
    let releaseSink: () => void = () => undefined;
    const sinkResult = new Promise<void>((resolve) => {
      releaseSink = resolve;
    });
    const app = buildApp({
      observabilitySink() {
        return sinkResult;
      },
    });
    apps.push(app);
    app.get("/slow-error-sink", async () => {
      throw new Error("expected test error");
    });

    const responsePromise = app.inject({ method: "GET", url: "/slow-error-sink" });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      responsePromise.then((response) => ({ response })),
      new Promise<{ timedOut: true }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ timedOut: true }), 100);
      }),
    ]);
    clearTimeout(timeoutId);
    releaseSink();
    await responsePromise;

    expect(outcome).not.toEqual({ timedOut: true });
    expect("response" in outcome && outcome.response.statusCode).toBe(500);
  });

  it("uses a no-op sink by default", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
  });
});
