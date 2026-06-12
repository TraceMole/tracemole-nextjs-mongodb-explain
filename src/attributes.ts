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
  scanType: `${MONGO_EXPLAIN_PREFIX}.scan_type`,
} as const;

export type MongoExplainAttributeKey = keyof typeof MONGO_EXPLAIN_ATTR;

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
    [MONGO_EXPLAIN_ATTR.scanType]: stats.scanType,
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
  const scanType = attributes[MONGO_EXPLAIN_ATTR.scanType];

  const indexUsedValue = indexUsed === true || indexUsed === "true";
  const stageValue = typeof stage === "string" ? stage : "unknown";
  const scanTypeValue =
    scanType === "index" || scanType === "collection" || scanType === "other"
      ? scanType
      : indexUsedValue
        ? "index"
        : stageValue === "COLLSCAN"
          ? "collection"
          : "other";

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
    indexUsed: indexUsedValue,
    indexName: typeof indexName === "string" ? indexName : undefined,
    stage: stageValue,
    scanType: scanTypeValue,
  };
}

export function hasMongoExplainAttributes(
  attributes: Record<string, string | number | boolean>,
): boolean {
  return MONGO_EXPLAIN_ATTR.operation in attributes;
}
