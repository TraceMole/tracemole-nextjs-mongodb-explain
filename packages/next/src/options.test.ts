import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_ENDPOINT, resolveOptions } from "./options";

describe("resolveOptions", () => {
  it("reads the API key, endpoint and service name from env", () => {
    const r = resolveOptions({}, {
      TRACEMOLE_API_KEY: "tm_live_a",
      TRACEMOLE_ENDPOINT: "http://localhost:4318/v1/traces",
      OTEL_SERVICE_NAME: "shop",
    });
    assert.equal(r.apiKey, "tm_live_a");
    assert.equal(r.endpoint, "http://localhost:4318/v1/traces");
    assert.equal(r.serviceName, "shop");
  });

  it("accepts the legacy TRACE_MOLE_API_KEY name and defaults the endpoint", () => {
    const r = resolveOptions({}, { TRACE_MOLE_API_KEY: "tm_live_b" });
    assert.equal(r.apiKey, "tm_live_b");
    assert.equal(r.endpoint, DEFAULT_ENDPOINT);
  });

  it("explicit options win over env", () => {
    const r = resolveOptions({ apiKey: "opt", serviceName: "svc" }, { TRACEMOLE_API_KEY: "env", OTEL_SERVICE_NAME: "env" });
    assert.equal(r.apiKey, "opt");
    assert.equal(r.serviceName, "svc");
  });

  it("explain is on in development with defaults", () => {
    const r = resolveOptions({}, { NODE_ENV: "development" });
    assert.deepEqual(r.explain, { enabled: true, slowThresholdMs: 100, sampleRate: 1 });
    assert.equal(r.debug, true);
  });

  it("explain is off in production unless opted in", () => {
    assert.equal(resolveOptions({}, { NODE_ENV: "production" }).explain.enabled, false);
    assert.equal(resolveOptions({ explain: { inProduction: true } }, { NODE_ENV: "production" }).explain.enabled, true);
    assert.equal(resolveOptions({}, { NODE_ENV: "production", TRACE_MOLE_MONGO_EXPLAIN: "1" }).explain.enabled, true);
    assert.equal(resolveOptions({}, { NODE_ENV: "production" }).debug, false);
  });

  it("TRACE_MOLE_MONGO_EXPLAIN=0 and explain:false turn it off", () => {
    assert.equal(resolveOptions({}, { TRACE_MOLE_MONGO_EXPLAIN: "0" }).explain.enabled, false);
    assert.equal(resolveOptions({ explain: false }, {}).explain.enabled, false);
  });

  it("clamps sampleRate and applies slowThresholdMs", () => {
    const r = resolveOptions({ explain: { sampleRate: 5, slowThresholdMs: 20 } }, {});
    assert.deepEqual(r.explain, { enabled: true, slowThresholdMs: 20, sampleRate: 1 });
  });
});
