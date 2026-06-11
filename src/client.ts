/** Browser-safe exports for the TraceMole dashboard (no Node / OTel deps). */
export {
  MONGO_EXPLAIN_ATTR,
  MONGO_EXPLAIN_PREFIX,
  explainAttributes,
  hasMongoExplainAttributes,
  readExplainFromAttributes,
} from "./attributes";
export type { MongoExplainAttributeValue } from "./attributes";
export type { MongoExplainStats } from "./types";
