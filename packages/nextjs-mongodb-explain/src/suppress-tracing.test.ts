import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createContextKey, ROOT_CONTEXT } from "@opentelemetry/api";

import { SUPPRESS_TRACING_KEY, suppressTracing } from "./suppress-tracing";

describe("suppressTracing", () => {
  it("uses the same key as @opentelemetry/core so SDK tracers skip spans", () => {
    const coreKey = createContextKey("OpenTelemetry SDK Context Key SUPPRESS_TRACING");
    assert.equal(SUPPRESS_TRACING_KEY, coreKey);
    assert.equal(suppressTracing(ROOT_CONTEXT).getValue(coreKey), true);
  });
});
