import { SpanKind } from "@opentelemetry/api";
import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace";

type WaitUntil = (promise: Promise<unknown>) => void;

const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

/** Vercel exposes the current request's waitUntil on a global request context. */
function currentWaitUntil(): WaitUntil | undefined {
  const holder = (globalThis as Record<symbol, { get?: () => { waitUntil?: WaitUntil } | undefined }>)[
    VERCEL_REQUEST_CONTEXT
  ];
  return holder?.get?.()?.waitUntil;
}

/**
 * Wraps a batch processor. When a request's root server span ends, flush and
 * hand the flush to the platform's waitUntil so a serverless function isn't
 * frozen before its spans are sent. Elsewhere this is a plain passthrough.
 */
export class FlushOnRequestEndProcessor implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}

  onStart(...args: Parameters<SpanProcessor["onStart"]>): void {
    this.inner.onStart(...args);
  }

  onEnd(span: ReadableSpan): void {
    this.inner.onEnd(span);
    if (span.kind !== SpanKind.SERVER || span.parentSpanContext) return;
    const waitUntil = currentWaitUntil();
    if (waitUntil) waitUntil(this.inner.forceFlush());
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}
