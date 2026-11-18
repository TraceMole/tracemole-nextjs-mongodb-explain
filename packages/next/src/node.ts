import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb";
import { MongooseInstrumentation } from "@opentelemetry/instrumentation-mongoose";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace";

import { MongoExplainInstrumentation } from "./explain-instrumentation";
import { FlushOnRequestEndProcessor } from "./flush-processor";
import { resolveOptions, type TraceMoleOptions } from "./options";

const STARTED = Symbol.for("tracemole.next.started");

/** Start the OpenTelemetry Node SDK configured for TraceMole. Safe to call twice. */
export function startTraceMole(options: TraceMoleOptions = {}): NodeSDK | undefined {
  const g = globalThis as Record<symbol, NodeSDK | undefined>;
  if (g[STARTED]) return g[STARTED];

  const config = resolveOptions(options);
  const log = (msg: string) => config.debug && console.log(`[tracemole] ${msg}`);

  if (!config.apiKey) {
    console.warn(
      "[tracemole] TRACEMOLE_API_KEY is not set: tracing is disabled. Create a key in your TraceMole project settings.",
    );
    return undefined;
  }

  // NodeSDK would otherwise also start OTLP metrics/logs exporters from env
  // defaults (localhost:4318). TraceMole only ingests traces.
  process.env.OTEL_METRICS_EXPORTER ??= "none";
  process.env.OTEL_LOGS_EXPORTER ??= "none";

  const exporter = new OTLPTraceExporter({
    url: config.endpoint,
    headers: { "x-api-key": config.apiKey },
  });

  const instrumentations: Instrumentation[] = [
    // Next.js creates its own request spans (with http.route); tracing incoming
    // requests here too would duplicate every server span. Keep outgoing calls.
    new HttpInstrumentation({ disableIncomingRequestInstrumentation: true }),
    new UndiciInstrumentation(),
    // Only trace queries inside a request (skips connection handshakes, auth, pings).
    new MongoDBInstrumentation({ requireParentSpan: true }),
    new MongooseInstrumentation(),
  ];
  if (config.explain.enabled) {
    instrumentations.push(
      new MongoExplainInstrumentation({
        slowThresholdMs: config.explain.slowThresholdMs,
        sampleRate: config.explain.sampleRate,
      }),
    );
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ "service.name": config.serviceName }),
    spanProcessors: [new FlushOnRequestEndProcessor(new BatchSpanProcessor({ exporter }))],
    instrumentations,
  });
  sdk.start();
  g[STARTED] = sdk;

  log(`sending traces to ${config.endpoint} as "${config.serviceName}"`);
  log(
    config.explain.enabled
      ? `MongoDB explain on for queries slower than ${config.explain.slowThresholdMs} ms`
      : `MongoDB explain off (${config.explain.reason})`,
  );

  return sdk;
}
