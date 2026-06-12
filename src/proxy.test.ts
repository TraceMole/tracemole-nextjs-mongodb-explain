import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { trace } from "@opentelemetry/api";
import type { Collection, Db } from "mongodb";
import { traceMoleCollection } from "./proxy";

describe("traceMoleCollection", () => {
  it("runs explain after find().toArray()", async () => {
    const explain = mock.fn(async () => ({
      executionStats: {
        executionSuccess: true,
        nReturned: 1,
        executionTimeMillis: 3,
        totalKeysExamined: 1,
        totalDocsExamined: 1,
        executionStages: { stage: "IXSCAN", indexName: "status_1" },
      },
      command: { find: "users" },
    }));

    const toArray = mock.fn(async () => [{ _id: "1" }]);
    const find = mock.fn(() => ({ explain, toArray }));

    const collection = { find } as unknown as Collection;
    const db = {
      collection: mock.fn(() => collection),
    } as unknown as Db;

    const setAttributes = mock.fn();
    const span = trace.getTracer("test").startSpan("request");
    mock.method(span, "setAttributes", setAttributes);
    mock.method(trace, "getActiveSpan", () => span);

    const users = traceMoleCollection(db, "users", { enabled: true, sampleRate: 1 });
    const result = await users.find({ status: "active" }).toArray();

    assert.deepEqual(result, [{ _id: "1" }]);
    assert.equal(find.mock.calls.length, 1);
    assert.equal(toArray.mock.calls.length, 1);

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(explain.mock.calls.length, 1);
    assert.equal(setAttributes.mock.calls.length, 1);
    span.end();
  });

  it("skips explain when disabled via enabled: false", async () => {
    const explain = mock.fn(async () => ({}));
    const toArray = mock.fn(async () => []);
    const find = mock.fn(() => ({ explain, toArray }));

    const collection = { find } as unknown as Collection;
    const db = {
      collection: mock.fn(() => collection),
    } as unknown as Db;

    const users = traceMoleCollection(db, "users", { enabled: false });
    await users.find({}).toArray();

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(explain.mock.calls.length, 0);
  });
});
