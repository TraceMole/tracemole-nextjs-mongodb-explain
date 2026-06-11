import type { MongoExplainStats } from "./types";

/** OpenTelemetry span attribute prefix for MongoDB explain stats. */
export const MONGO_EXPLAIN_PREFIX = "db.mongodb.explain";

export const MONGO_EXPLAIN_ATTR = {
  operation: `${MONGO_EXPLAIN_PREFIX}.operation`,
  collection: `${MONGO_EXPLAIN_PREFIX}.collection`,
  docsExamined: `${MONGO_EXPLAIN_PREFIX}.docs_examined`,
  docsReturned: `${MONGO_EXPLAIN_PREFIX}.docs_returned`,
  keysExamined: `${MONGO_EXPLAIN_PREFIX}.keys_examined`,
  executionTimeMs: `${MONGO_EXPLAIN_PREFIX}.execution_time_ms`,
  indexUsed: `${MONGO_EXPLAIN_PREFIX}.index_used`,
  indexName: `${MONGO_EXPLAIN_PREFIX}.index_name`,
  stage: `${MONGO_EXPLAIN_PREFIX}.stage`,
} as const;

export type MongoExplainAttributeValue = string | number | boolean;

export function explainAttributes(
  stats: MongoExplainStats,
): Record<string, MongoExplainAttributeValue> {
  const attrs: Record<string, MongoExplainAttributeValue> = {
    [MONGO_EXPLAIN_ATTR.operation]: stats.operation,
    [MONGO_EXPLAIN_ATTR.docsExamined]: stats.docsExamined,
    [MONGO_EXPLAIN_ATTR.docsReturned]: stats.docsReturned,
    [MONGO_EXPLAIN_ATTR.keysExamined]: stats.keysExamined,
    [MONGO_EXPLAIN_ATTR.executionTimeMs]: stats.executionTimeMs,
    [MONGO_EXPLAIN_ATTR.indexUsed]: stats.indexUsed,
    [MONGO_EXPLAIN_ATTR.stage]: stats.stage,
  };

  if (stats.collection) attrs[MONGO_EXPLAIN_ATTR.collection] = stats.collection;
  if (stats.indexName) attrs[MONGO_EXPLAIN_ATTR.indexName] = stats.indexName;

  return attrs;
}

export function readExplainFromAttributes(
  attributes: Record<string, string | number | boolean>,
): MongoExplainStats | null {
  const operation = attributes[MONGO_EXPLAIN_ATTR.operation];
  if (typeof operation !== "string" || !operation) return null;

  const docsExamined = attributes[MONGO_EXPLAIN_ATTR.docsExamined];
  const docsReturned = attributes[MONGO_EXPLAIN_ATTR.docsReturned];
  const keysExamined = attributes[MONGO_EXPLAIN_ATTR.keysExamined];
  const executionTimeMs = attributes[MONGO_EXPLAIN_ATTR.executionTimeMs];
  const indexUsed = attributes[MONGO_EXPLAIN_ATTR.indexUsed];
  const stage = attributes[MONGO_EXPLAIN_ATTR.stage];
  const collection = attributes[MONGO_EXPLAIN_ATTR.collection];
  const indexName = attributes[MONGO_EXPLAIN_ATTR.indexName];

  return {
    operation,
    collection: typeof collection === "string" ? collection : undefined,
    docsExamined: typeof docsExamined === "number" ? docsExamined : Number(docsExamined ?? 0),
    docsReturned: typeof docsReturned === "number" ? docsReturned : Number(docsReturned ?? 0),
    keysExamined: typeof keysExamined === "number" ? keysExamined : Number(keysExamined ?? 0),
    executionTimeMs:
      typeof executionTimeMs === "number"
        ? executionTimeMs
        : Number(executionTimeMs ?? 0),
    indexUsed: indexUsed === true || indexUsed === "true",
    indexName: typeof indexName === "string" ? indexName : undefined,
    stage: typeof stage === "string" ? stage : "unknown",
    scanType:
      indexUsed === true || indexUsed === "true"
        ? "index"
        : stage === "COLLSCAN"
          ? "collection"
          : "other",
  };
}

export function hasMongoExplainAttributes(
  attributes: Record<string, string | number | boolean>,
): boolean {
  return MONGO_EXPLAIN_ATTR.operation in attributes;
}
