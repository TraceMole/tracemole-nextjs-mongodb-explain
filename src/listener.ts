import { trace, type Span } from "@opentelemetry/api";
import type {
  CommandFailedEvent,
  CommandStartedEvent,
  CommandSucceededEvent,
  Document,
  MongoClient,
} from "mongodb";
import { attachExplainToSpan } from "./attach";
import { isExplainEnabled } from "./enabled";
import { parseExplainStats } from "./parse";
import { runWithoutTracing } from "./suppress-tracing";

export interface TraceMoleListenerOptions {
  /** Only explain queries slower than this (ms). Default: 100 */
  slowThreshold?: number;
  /** Sample rate 0–1. Default: 1 (always) */
  sampleRate?: number;
  /** Skip in production unless explicitly opted in */
  enabled?: boolean;
}

type PendingCommand = {
  command: Document;
  databaseName: string;
  span: Span | undefined;
};

type ResolvedListenerOptions = {
  slowThreshold: number;
  sampleRate: number;
  enabled?: boolean;
};

const SKIP_COMMANDS = new Set([
  "explain",
  "hello",
  "ismaster",
  "isMaster",
  "ping",
  "endSessions",
  "getMore",
  "saslStart",
  "saslContinue",
  "buildInfo",
  "createIndexes",
  "dropIndexes",
  "listIndexes",
  "listCollections",
  "listDatabases",
]);

const EXPLAINABLE_COMMANDS = new Set([
  "find",
  "aggregate",
  "count",
  "distinct",
  "delete",
  "update",
  "findAndModify",
]);

type ListenerState = {
  pending: Map<number, PendingCommand>;
  options: ResolvedListenerOptions;
  onStarted: (event: CommandStartedEvent) => void;
  onSucceeded: (event: CommandSucceededEvent) => void;
  onFailed: (event: CommandFailedEvent) => void;
};

const registeredClients = new WeakMap<MongoClient, ListenerState>();

function shouldSample(sampleRate: number): boolean {
  return Math.random() <= sampleRate;
}

async function runExplainForCommand(
  client: MongoClient,
  pending: PendingCommand,
): Promise<void> {
  const { span, command, databaseName } = pending;
  if (!span) return;

  const db = client.db(databaseName);
  const explainResult = await runWithoutTracing(() =>
    db.command({
      explain: command,
      verbosity: "executionStats",
    }),
  );
  const stats = parseExplainStats(explainResult);
  attachExplainToSpan(span, stats);
}

function handleCommandSucceeded(
  client: MongoClient,
  state: ListenerState,
  event: CommandSucceededEvent,
): void {
  const pending = state.pending.get(event.requestId);
  state.pending.delete(event.requestId);
  if (!pending) return;

  if (SKIP_COMMANDS.has(event.commandName)) return;
  if (!EXPLAINABLE_COMMANDS.has(event.commandName)) return;
  if (!isExplainEnabled(state.options.enabled)) return;
  if (event.duration < state.options.slowThreshold) return;
  if (!shouldSample(state.options.sampleRate)) return;
  if (!pending.span) return;

  void runExplainForCommand(client, pending).catch(() => {
    // Explain is best-effort for local profiling.
  });
}

function createListenerState(
  client: MongoClient,
  options: TraceMoleListenerOptions = {},
): ListenerState {
  const resolvedOptions: ResolvedListenerOptions = {
    slowThreshold: options.slowThreshold ?? 100,
    sampleRate: options.sampleRate ?? 1,
    enabled: options.enabled,
  };

  const pending = new Map<number, PendingCommand>();

  const onStarted = (event: CommandStartedEvent) => {
    if (SKIP_COMMANDS.has(event.commandName)) return;
    if (!EXPLAINABLE_COMMANDS.has(event.commandName)) return;
    if (!isExplainEnabled(resolvedOptions.enabled)) return;

    pending.set(event.requestId, {
      command: event.command,
      databaseName: event.databaseName,
      span: trace.getActiveSpan(),
    });
  };

  const onSucceeded = (event: CommandSucceededEvent) => {
    handleCommandSucceeded(client, { pending, options: resolvedOptions, onStarted, onSucceeded, onFailed }, event);
  };

  const onFailed = (event: CommandFailedEvent) => {
    pending.delete(event.requestId);
  };

  return { pending, options: resolvedOptions, onStarted, onSucceeded, onFailed };
}

export function registerTraceMoleListener(
  client: MongoClient,
  options: TraceMoleListenerOptions = {},
): void {
  if (registeredClients.has(client)) return;
  if (!isExplainEnabled(options.enabled)) return;

  const state = createListenerState(client, options);
  client.on("commandStarted", state.onStarted);
  client.on("commandSucceeded", state.onSucceeded);
  client.on("commandFailed", state.onFailed);
  registeredClients.set(client, state);
}

export function unregisterTraceMoleListener(client: MongoClient): void {
  const state = registeredClients.get(client);
  if (!state) return;

  client.off("commandStarted", state.onStarted);
  client.off("commandSucceeded", state.onSucceeded);
  client.off("commandFailed", state.onFailed);
  state.pending.clear();
  registeredClients.delete(client);
}
