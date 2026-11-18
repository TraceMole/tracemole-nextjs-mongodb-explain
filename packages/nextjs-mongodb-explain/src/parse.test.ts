import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseExplainStats } from "./parse";

describe("parseExplainStats", () => {
  it("parses classic find executionStats", () => {
    const stats = parseExplainStats({
      command: { find: "movies" },
      executionStats: {
        nReturned: 5,
        executionTimeMillis: 96,
        totalDocsExamined: 21349,
        totalKeysExamined: 0,
        executionStages: {
          stage: "SORT",
          inputStage: { stage: "COLLSCAN", docsExamined: 21349 },
        },
      },
    });

    assert.equal(stats.operation, "find");
    assert.equal(stats.collection, "movies");
    assert.equal(stats.docsExamined, 21349);
    assert.equal(stats.docsReturned, 5);
    assert.equal(stats.keysExamined, 0);
    assert.equal(stats.indexUsed, false);
    assert.equal(stats.scanType, "collection");
  });

  it("parses indexed find executionStats", () => {
    const stats = parseExplainStats({
      command: { find: "movies" },
      executionStats: {
        nReturned: 5,
        executionTimeMillis: 1,
        totalKeysExamined: 5,
        totalDocsExamined: 5,
        executionStages: {
          stage: "LIMIT",
          inputStage: {
            stage: "FETCH",
            inputStage: { stage: "IXSCAN", indexName: "year_-1" },
          },
        },
      },
    });

    assert.equal(stats.indexUsed, true);
    assert.equal(stats.indexName, "year_-1");
    assert.equal(stats.scanType, "index");
  });

  it("parses aggregate stages with $cursor executionStats", () => {
    const stats = parseExplainStats({
      command: { aggregate: "sales", pipeline: [{ $group: { _id: "$item" } }] },
      stages: [
        {
          $cursor: {
            executionStats: {
              stage: "COLLSCAN",
              nReturned: 220,
              totalDocsExamined: 250000,
              executionTimeMillisEstimate: 92,
            },
          },
        },
        { $group: { executionTimeMillisEstimate: 31 } },
      ],
    });

    assert.equal(stats.operation, "aggregate");
    assert.equal(stats.collection, "sales");
    assert.equal(stats.docsExamined, 250000);
    assert.equal(stats.docsReturned, 220);
    assert.equal(stats.executionTimeMs, 123);
    assert.equal(stats.indexUsed, false);
    assert.equal(stats.scanType, "collection");
  });

  it("parses aggregate top-level executionStats with indexesUsed", () => {
    const stats = parseExplainStats({
      command: { aggregate: "accounts" },
      executionStats: {
        nReturned: 1746,
        executionTimeMillis: 9,
        totalDocsExamined: 1746,
        totalKeysExamined: 1746,
        indexesUsed: ["email_1"],
        executionStages: { stage: "EQ_LOOKUP" },
      },
    });

    assert.equal(stats.docsExamined, 1746);
    assert.equal(stats.indexUsed, true);
    assert.equal(stats.indexName, "email_1");
  });

  it("parses profiler-style docsExamined fields", () => {
    const stats = parseExplainStats({
      docsExamined: 5555,
      keysExamined: 0,
      nreturned: 12,
      millis: 46,
      planSummary: "COLLSCAN",
      command: { find: "listingsAndReviews" },
    });

    assert.equal(stats.docsExamined, 5555);
    assert.equal(stats.docsReturned, 12);
    assert.equal(stats.scanType, "collection");
  });
});
