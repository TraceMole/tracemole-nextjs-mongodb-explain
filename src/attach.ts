import type { Span } from "@opentelemetry/api";
import { explainAttributes } from "./attributes";
import type { MongoExplainStats } from "./types";

export function attachExplainToSpan(
  span: Span,
  stats: MongoExplainStats,
): void {
  span.setAttributes(explainAttributes(stats));
}

export async function attachExplainToActiveSpan(
  stats: MongoExplainStats,
): Promise<boolean> {
  try {
    const { trace } = await import("@opentelemetry/api");
    const span = trace.getActiveSpan();
    if (!span) return false;
    attachExplainToSpan(span, stats);
    return true;
  } catch {
    return false;
  }
}
