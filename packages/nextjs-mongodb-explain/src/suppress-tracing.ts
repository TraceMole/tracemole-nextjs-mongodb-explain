import { context, createContextKey, type Context } from "@opentelemetry/api";

/**
 * Same key as @opentelemetry/core's suppressTracing(). createContextKey uses
 * Symbol.for(description), so matching the description is enough: the SDK then
 * skips spans (e.g. the driver's own `explain` span) for work done inside.
 */
export const SUPPRESS_TRACING_KEY = createContextKey("OpenTelemetry SDK Context Key SUPPRESS_TRACING");

export function suppressTracing(ctx: Context): Context {
  return ctx.setValue(SUPPRESS_TRACING_KEY, true);
}

export function runWithoutTracing<T>(fn: () => Promise<T>): Promise<T> {
  return context.with(suppressTracing(context.active()), fn);
}
