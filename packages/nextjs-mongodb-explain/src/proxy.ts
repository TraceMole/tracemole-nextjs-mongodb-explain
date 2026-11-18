import { trace, type Span } from "@opentelemetry/api";
import type { Collection, Db, Document } from "mongodb";
import { attachExplainToSpan } from "./attach";
import { isExplainEnabled } from "./enabled";
import { parseExplainStats } from "./parse";
import { runWithoutTracing } from "./suppress-tracing";

export interface TraceMoleProxyOptions {
  /** Skip explain entirely (default: only when `TRACE_MOLE_MONGO_EXPLAIN=0`). */
  enabled?: boolean;
  /** Sample rate 0–1. Default: 1 (always) */
  sampleRate?: number;
}

type CursorLike = {
  explain: (verbosity?: string) => Promise<unknown>;
  toArray: () => Promise<unknown[]>;
  next: () => Promise<unknown>;
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
};

function shouldSample(sampleRate: number): boolean {
  return Math.random() <= sampleRate;
}

async function attachExplainFromCursor(
  cursor: CursorLike,
  span: Span,
): Promise<void> {
  const explainResult = await runWithoutTracing(() =>
    cursor.explain("executionStats"),
  );
  const stats = parseExplainStats(explainResult);
  attachExplainToSpan(span, stats);
}

function maybeAttachExplain(
  cursor: CursorLike,
  options: Required<Pick<TraceMoleProxyOptions, "sampleRate">> &
    Pick<TraceMoleProxyOptions, "enabled">,
): void {
  if (!isExplainEnabled(options.enabled)) return;
  if (!shouldSample(options.sampleRate)) return;

  const span = trace.getActiveSpan();
  if (!span) return;

  void attachExplainFromCursor(cursor, span).catch(() => {
    // Explain is best-effort for local profiling.
  });
}

function wrapCursor<T extends CursorLike>(
  cursor: T,
  options: Required<Pick<TraceMoleProxyOptions, "sampleRate">> &
    Pick<TraceMoleProxyOptions, "enabled">,
): T {
  let explainScheduled = false;

  const scheduleExplain = () => {
    if (explainScheduled) return;
    explainScheduled = true;
    maybeAttachExplain(cursor, options);
  };

  return new Proxy(cursor, {
    get(target, prop, receiver) {
      if (prop === "toArray") {
        return async (...args: unknown[]) => {
          const result = await Reflect.apply(
            target.toArray as (...a: unknown[]) => Promise<unknown[]>,
            target,
            args,
          );
          scheduleExplain();
          return result;
        };
      }

      if (prop === "next") {
        return async (...args: unknown[]) => {
          const result = await Reflect.apply(
            target.next as (...a: unknown[]) => Promise<unknown>,
            target,
            args,
          );
          scheduleExplain();
          return result;
        };
      }

      if (prop === Symbol.asyncIterator) {
        const iterator = target[Symbol.asyncIterator]?.call(target);
        if (!iterator) {
          return Reflect.get(target, prop, receiver);
        }

        return async function* () {
          for await (const doc of iterator) {
            yield doc;
          }
          scheduleExplain();
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

async function runWithExplain<T>(
  run: () => Promise<T>,
  explain: () => Promise<unknown>,
  options: Required<Pick<TraceMoleProxyOptions, "sampleRate">> &
    Pick<TraceMoleProxyOptions, "enabled">,
): Promise<T> {
  const result = await run();

  if (!isExplainEnabled(options.enabled)) return result;
  if (!shouldSample(options.sampleRate)) return result;

  const span = trace.getActiveSpan();
  if (!span) return result;

  void runWithoutTracing(explain)
    .then((explainResult) => {
      const stats = parseExplainStats(explainResult);
      attachExplainToSpan(span, stats);
    })
    .catch(() => {
      // Explain is best-effort for local profiling.
    });

  return result;
}

export function traceMoleCollection<TSchema extends Document = Document>(
  db: Db,
  name: string,
  options: TraceMoleProxyOptions = {},
): Collection<TSchema> {
  const collection = db.collection<TSchema>(name);
  const resolvedOptions = {
    sampleRate: options.sampleRate ?? 1,
    enabled: options.enabled,
  };

  return new Proxy(collection, {
    get(target, prop, receiver) {
      if (prop === "find") {
        return (...args: Parameters<Collection<TSchema>["find"]>) => {
          const cursor = target.find(...args);
          return wrapCursor(cursor as unknown as CursorLike, resolvedOptions);
        };
      }

      if (prop === "aggregate") {
        return (...args: Parameters<Collection<TSchema>["aggregate"]>) => {
          const cursor = target.aggregate(...args);
          return wrapCursor(cursor as unknown as CursorLike, resolvedOptions);
        };
      }

      if (prop === "countDocuments") {
        return (...args: Parameters<Collection<TSchema>["countDocuments"]>) => {
          const filter = (args[0] ?? {}) as Parameters<Collection<TSchema>["find"]>[0];
          return runWithExplain(
            () => target.countDocuments(...args),
            () => target.find(filter).explain("executionStats"),
            resolvedOptions,
          );
        };
      }

      if (prop === "distinct") {
        return (...args: Parameters<Collection<TSchema>["distinct"]>) => {
          const filter = (args[1] ?? {}) as Parameters<Collection<TSchema>["find"]>[0];
          return runWithExplain(
            () => target.distinct(...args),
            () => target.find(filter).explain("executionStats"),
            resolvedOptions,
          );
        };
      }

      if (prop === "findOne") {
        return (...args: Parameters<Collection<TSchema>["findOne"]>) =>
          runWithExplain(
            () => target.findOne(...args),
            () => target.find(...args).limit(1).explain("executionStats"),
            resolvedOptions,
          );
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as Collection<TSchema>;
}
