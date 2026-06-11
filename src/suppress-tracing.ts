import { context, createContextKey, type Context } from "@opentelemetry/api";

/** Matches @opentelemetry/core SUPPRESS_TRACING_KEY so driver spans are skipped. */
const SUPPRESS_TRACING_KEY = createContextKey("suppress_tracing");

export function suppressTracing(ctx: Context): Context {
  return ctx.setValue(SUPPRESS_TRACING_KEY, true);
}

export function runWithoutTracing<T>(fn: () => Promise<T>): Promise<T> {
  return context.with(suppressTracing(context.active()), fn);
}
