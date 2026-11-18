import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MONGO_EXPLAIN_ATTR, explainAttributes, readExplainFromAttributes } from "./attributes";
import type { MongoExplainStats } from "./types";

describe("attributes scanType round-trip", () => {
  it("writes scanType to span attributes", () => {
    const stats: MongoExplainStats = {
      operation: "find",
      collection: "users",
      docsExamined: 100,
      docsReturned: 1,
      keysExamined: 0,
      executionTimeMs: 12,
      indexUsed: false,
      stage: "COLLSCAN",
      scanType: "collection",
    };

    const attrs = explainAttributes(stats);
    assert.equal(attrs[MONGO_EXPLAIN_ATTR.scanType], "collection");
  });

  it("reads scanType from span attributes", () => {
    const stats: MongoExplainStats = {
      operation: "find",
      docsExamined: 1,
      docsReturned: 1,
      keysExamined: 1,
      executionTimeMs: 1,
      indexUsed: true,
      indexName: "status_1",
      stage: "IXSCAN",
      scanType: "index",
    };

    const roundTrip = readExplainFromAttributes(explainAttributes(stats));
    assert.equal(roundTrip?.operation, stats.operation);
    assert.equal(roundTrip?.scanType, stats.scanType);
    assert.equal(roundTrip?.indexUsed, stats.indexUsed);
    assert.equal(roundTrip?.stage, stats.stage);
  });

  it("infers scanType when attribute is missing", () => {
    const stats = readExplainFromAttributes({
      [MONGO_EXPLAIN_ATTR.operation]: "find",
      [MONGO_EXPLAIN_ATTR.docsExamined]: 10,
      [MONGO_EXPLAIN_ATTR.docsReturned]: 1,
      [MONGO_EXPLAIN_ATTR.keysExamined]: 0,
      [MONGO_EXPLAIN_ATTR.executionTimeMs]: 5,
      [MONGO_EXPLAIN_ATTR.indexUsed]: false,
      [MONGO_EXPLAIN_ATTR.stage]: "COLLSCAN",
    });

    assert.equal(stats?.scanType, "collection");
  });
});
