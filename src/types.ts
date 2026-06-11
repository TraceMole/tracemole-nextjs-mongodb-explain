export type MongoExplainStats = {
  /** MongoDB command type: find, aggregate, count, etc. */
  operation: string;
  collection?: string;
  /** Documents examined (scanned) during execution. */
  docsExamined: number;
  /** Documents returned to the client. */
  docsReturned: number;
  /** Index keys examined (0 when no index used). */
  keysExamined: number;
  executionTimeMs: number;
  /** True when the winning plan used an index (IXSCAN). */
  indexUsed: boolean;
  indexName?: string;
  /** Winning plan stage: IXSCAN, COLLSCAN, FETCH, etc. */
  stage: string;
  scanType: "index" | "collection" | "other";
};
