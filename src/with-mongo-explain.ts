import { attachExplainToSpan } from "./attach";
import { parseExplainStats } from "./parse";
import { runWithoutTracing } from "./suppress-tracing";

export type WithMongoExplainOptions<T> = {
  /** Run the real query (already instrumented by OTel MongoDB driver). */
  run: () => Promise<T>;
  /** Run the same command with `.explain("executionStats")`. */
  explain: () => Promise<unknown>;
  /** Skip explain entirely (default: only when `TRACE_MOLE_MONGO_EXPLAIN=0`). */
  enabled?: boolean;
  /** Optional span label shown in the dashboard (e.g. "events aggregate"). */
  label?: string;
};

function isExplainEnabled(explicit?: boolean): boolean {
  if (explicit != null) return explicit;
  return process.env.TRACE_MOLE_MONGO_EXPLAIN !== "0";
}

/**
 * Run a MongoDB operation and attach executionStats from a parallel explain call
 * to a dedicated query span (one per `withMongoExplain` call).
 *
 * Explain runs after the query without creating a `mongodb.explain` driver span.
 * Set `TRACE_MOLE_MONGO_EXPLAIN=0` to disable in production.
 */
export async function withMongoExplain<T>({
  run,
  explain,
  enabled,
  label,
}: WithMongoExplainOptions<T>): Promise<T> {
  const { trace } = await import("@opentelemetry/api");
  const tracer = trace.getTracer("tracemole.mongo");

  return tracer.startActiveSpan(label ?? "mongodb.query", async (span) => {
    try {
      const result = await run();

      if (isExplainEnabled(enabled)) {
        try {
          const explainResult = await runWithoutTracing(() => explain());
          const stats = parseExplainStats(explainResult);
          attachExplainToSpan(span, stats);
        } catch {
          // Explain is best-effort for local profiling.
        }
      }

      return result;
    } finally {
      span.end();
    }
  });
}
