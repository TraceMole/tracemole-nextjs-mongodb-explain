import type { MongoExplainStats } from "./types";

type ExplainStage = {
  stage?: string;
  indexName?: string;
  docsExamined?: number;
  keysExamined?: number;
  inputStage?: ExplainStage;
  inputStages?: ExplainStage[];
};

type NormalizedExecution = {
  nReturned: number;
  executionTimeMs: number;
  keysExamined: number;
  docsExamined: number;
  executionStages?: ExplainStage;
  indexesUsed: string[];
  planSummary?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asStage(value: unknown): ExplainStage | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    stage: typeof record.stage === "string" ? record.stage : undefined,
    indexName:
      typeof record.indexName === "string" ? record.indexName : undefined,
    docsExamined: asNumber(record.docsExamined),
    keysExamined: asNumber(record.keysExamined),
    inputStage: asStage(record.inputStage) ?? undefined,
    inputStages: Array.isArray(record.inputStages)
      ? record.inputStages
          .map((s) => asStage(s))
          .filter((s): s is ExplainStage => s != null)
      : undefined,
  };
}

function walkStages(stage: ExplainStage | undefined): ExplainStage[] {
  if (!stage) return [];
  const nested = stage.inputStage
    ? walkStages(stage.inputStage)
    : (stage.inputStages ?? []).flatMap((s) => walkStages(s));
  return [stage, ...nested];
}

function findIndexStage(stages: ExplainStage[]): ExplainStage | undefined {
  return stages.find((s) => s.stage === "IXSCAN");
}

function findCollScanStage(stages: ExplainStage[]): ExplainStage | undefined {
  return stages.find((s) => s.stage === "COLLSCAN");
}

function readIndexesUsed(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function mergeExecution(
  current: NormalizedExecution | null,
  next: NormalizedExecution,
): NormalizedExecution {
  if (!current) return next;
  return {
    nReturned: Math.max(current.nReturned, next.nReturned),
    executionTimeMs: current.executionTimeMs + next.executionTimeMs,
    keysExamined: current.keysExamined + next.keysExamined,
    docsExamined: current.docsExamined + next.docsExamined,
    executionStages: current.executionStages ?? next.executionStages,
    indexesUsed: [...new Set([...current.indexesUsed, ...next.indexesUsed])],
    planSummary: current.planSummary ?? next.planSummary,
  };
}

function fromExecutionStatsBlock(
  stats: Record<string, unknown>,
): NormalizedExecution {
  const executionStages =
    asStage(stats.executionStages) ??
    (typeof stats.stage === "string" ? asStage(stats) : null);

  return {
    nReturned: asNumber(stats.nReturned) ?? 0,
    executionTimeMs:
      asNumber(stats.executionTimeMillis) ??
      asNumber(stats.executionTimeMillisEstimate) ??
      0,
    keysExamined: asNumber(stats.totalKeysExamined) ?? 0,
    docsExamined: asNumber(stats.totalDocsExamined) ?? 0,
    executionStages: executionStages ?? undefined,
    indexesUsed: readIndexesUsed(stats.indexesUsed),
    planSummary:
      typeof stats.planSummary === "string" ? stats.planSummary : undefined,
  };
}

function fromStageTree(stats: Record<string, unknown>): NormalizedExecution {
  const stageTree = asStage(stats.executionStages ?? stats) ?? undefined;
  const walked = walkStages(stageTree);
  const indexStage = findIndexStage(walked);
  const collScan = findCollScanStage(walked);

  const docsFromStages = walked.reduce(
    (sum, s) => sum + (s.docsExamined ?? 0),
    0,
  );
  const keysFromStages = walked.reduce(
    (sum, s) => sum + (s.keysExamined ?? 0),
    0,
  );

  return {
    nReturned: asNumber(stats.nReturned) ?? 0,
    executionTimeMs:
      asNumber(stats.executionTimeMillis) ??
      asNumber(stats.executionTimeMillisEstimate) ??
      0,
    keysExamined: asNumber(stats.totalKeysExamined) ?? keysFromStages,
    docsExamined: asNumber(stats.totalDocsExamined) ?? docsFromStages,
    executionStages: stageTree,
    indexesUsed: [
      ...readIndexesUsed(stats.indexesUsed),
      ...(indexStage?.indexName ? [indexStage.indexName] : []),
    ],
    planSummary:
      typeof stats.planSummary === "string" ? stats.planSummary : undefined,
  };
}

function collectFromPipelineStages(stages: unknown[]): NormalizedExecution | null {
  let merged: NormalizedExecution | null = null;

  for (const stageEntry of stages) {
    const entry = asRecord(stageEntry);
    if (!entry) continue;

    for (const [stageName, stageBody] of Object.entries(entry)) {
      const body = asRecord(stageBody);
      if (!body) continue;

      const stats = asRecord(body.executionStats);
      if (stats) {
        const normalized =
          asNumber(stats.totalDocsExamined) != null ||
          asNumber(stats.totalKeysExamined) != null
            ? fromExecutionStatsBlock(stats)
            : fromStageTree(stats);
        merged = mergeExecution(merged, normalized);
      } else if (asNumber(body.executionTimeMillisEstimate) != null) {
        merged = mergeExecution(merged, {
          nReturned: 0,
          executionTimeMs: asNumber(body.executionTimeMillisEstimate) ?? 0,
          keysExamined: 0,
          docsExamined: 0,
          indexesUsed: [],
        });
      }

      if (stageName === "$cursor") {
        const planner = asRecord(body.queryPlanner);
        const winning = asRecord(planner?.winningPlan);
        if (winning && !merged?.executionStages) {
          const stageTree = asStage(winning) ?? undefined;
          merged = mergeExecution(merged, {
            nReturned: 0,
            executionTimeMs: 0,
            keysExamined: 0,
            docsExamined: 0,
            executionStages: stageTree,
            indexesUsed: [],
          });
        }
      }
    }
  }

  return merged;
}

function normalizeExecution(explain: Record<string, unknown>): NormalizedExecution | null {
  const topStats = asRecord(explain.executionStats);
  if (topStats) {
    const normalized =
      asNumber(topStats.totalDocsExamined) != null ||
      asNumber(topStats.totalKeysExamined) != null ||
      topStats.executionStages != null
        ? fromExecutionStatsBlock(topStats)
        : fromStageTree(topStats);
    return normalized;
  }

  if (Array.isArray(explain.stages)) {
    return collectFromPipelineStages(explain.stages);
  }

  // system.profile / Atlas profiler shape
  if (asNumber(explain.docsExamined) != null) {
    return {
      nReturned:
        asNumber(explain.nreturned) ?? asNumber(explain.nReturned) ?? 0,
      executionTimeMs:
        asNumber(explain.millis) ?? asNumber(explain.durationMillis) ?? 0,
      keysExamined: asNumber(explain.keysExamined) ?? 0,
      docsExamined: asNumber(explain.docsExamined) ?? 0,
      indexesUsed: [],
      planSummary:
        typeof explain.planSummary === "string" ? explain.planSummary : undefined,
    };
  }

  return null;
}

function commandOperation(command: Record<string, unknown>): string {
  const ops = [
    "find",
    "aggregate",
    "count",
    "distinct",
    "delete",
    "update",
    "findAndModify",
  ];
  for (const op of ops) {
    if (op in command) return op;
  }
  if (Array.isArray(command.pipeline)) return "aggregate";
  return "unknown";
}

function commandCollection(
  command: Record<string, unknown>,
  operation: string,
): string | undefined {
  const direct = command[operation];
  if (typeof direct === "string" && direct) return direct;
  const collection = command.collection;
  if (typeof collection === "string" && collection) return collection;
  return undefined;
}

function inferOperation(explain: Record<string, unknown>): string {
  const command = asRecord(explain.command);
  if (command) {
    const op = commandOperation(command);
    if (op !== "unknown") return op;
  }
  if (Array.isArray(explain.stages)) return "aggregate";
  return "unknown";
}

function inferCollection(
  explain: Record<string, unknown>,
  operation: string,
): string | undefined {
  const command = asRecord(explain.command);
  if (command) {
    const name = commandCollection(command, operation);
    if (name) return name;
  }

  const namespace = explain.namespace;
  if (typeof namespace === "string" && namespace.includes(".")) {
    return namespace.split(".").slice(1).join(".");
  }

  return undefined;
}

function indexUsedFrom(
  execution: NormalizedExecution,
  walked: ExplainStage[],
): { indexUsed: boolean; indexName?: string; stage: string; scanType: MongoExplainStats["scanType"] } {
  const indexStage = findIndexStage(walked);
  const collScanStage = findCollScanStage(walked);
  const indexName =
    indexStage?.indexName ?? execution.indexesUsed[0];
  const indexUsed =
    indexStage != null ||
    execution.indexesUsed.length > 0 ||
    execution.planSummary?.includes("IXSCAN") === true;

  const winningStage =
    indexStage ??
    collScanStage ??
    walked[0] ??
    ({ stage: execution.planSummary?.split(",")[0] ?? "unknown" } as ExplainStage);

  const stage = winningStage.stage ?? "unknown";
  const scanType: MongoExplainStats["scanType"] = indexUsed
    ? "index"
    : collScanStage || stage === "COLLSCAN" || execution.planSummary === "COLLSCAN"
      ? "collection"
      : "other";

  return { indexUsed, indexName, stage, scanType };
}

/**
 * Parse a MongoDB explain result (`verbosity: "executionStats"`) into summary stats.
 * Supports find, aggregate (`stages` + `$cursor`), and profiler-style shapes.
 */
export function parseExplainStats(explain: unknown): MongoExplainStats {
  const root = asRecord(explain);
  if (!root) {
    return emptyStats("unknown");
  }

  const execution = normalizeExecution(root);
  const operation = inferOperation(root);
  const collection = inferCollection(root, operation);
  const walked = walkStages(execution?.executionStages);
  const index = indexUsedFrom(execution ?? emptyExecution(), walked);

  return {
    operation,
    collection,
    docsExamined: execution?.docsExamined ?? 0,
    docsReturned: execution?.nReturned ?? 0,
    keysExamined: execution?.keysExamined ?? 0,
    executionTimeMs: execution?.executionTimeMs ?? 0,
    indexUsed: index.indexUsed,
    indexName: index.indexName,
    stage: index.stage,
    scanType: index.scanType,
  };
}

function emptyExecution(): NormalizedExecution {
  return {
    nReturned: 0,
    executionTimeMs: 0,
    keysExamined: 0,
    docsExamined: 0,
    indexesUsed: [],
  };
}

function emptyStats(operation: string): MongoExplainStats {
  return {
    operation,
    docsExamined: 0,
    docsReturned: 0,
    keysExamined: 0,
    executionTimeMs: 0,
    indexUsed: false,
    stage: "unknown",
    scanType: "other",
  };
}
