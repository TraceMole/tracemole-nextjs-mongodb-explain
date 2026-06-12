import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it, mock } from "node:test";
import { trace } from "@opentelemetry/api";
import type { CommandStartedEvent, CommandSucceededEvent, MongoClient } from "mongodb";
import {
  registerTraceMoleListener,
  unregisterTraceMoleListener,
} from "./listener";

describe("registerTraceMoleListener", () => {
  function createMockClient() {
    const emitter = new EventEmitter();
    const commandCalls: unknown[] = [];

    const db = {
      command: mock.fn(async (cmd: unknown) => {
        commandCalls.push(cmd);
        return {
          executionStats: {
            executionSuccess: true,
            nReturned: 1,
            executionTimeMillis: 5,
            totalKeysExamined: 0,
            totalDocsExamined: 10,
            executionStages: { stage: "COLLSCAN" },
          },
          command: { find: "users" },
        };
      }),
    };

    const client = Object.assign(emitter, {
      db: mock.fn(() => db),
    }) as unknown as MongoClient & EventEmitter;

    return { client, commandCalls };
  }

  function emitStarted(
    client: MongoClient & EventEmitter,
    overrides: Partial<CommandStartedEvent> = {},
  ) {
    const event = {
      requestId: 1,
      databaseName: "app",
      commandName: "find",
      command: { find: "users", filter: { status: "active" } },
      ...overrides,
    } as CommandStartedEvent;
    client.emit("commandStarted", event);
    return event;
  }

  function emitSucceeded(
    client: MongoClient & EventEmitter,
    overrides: Partial<CommandSucceededEvent> = {},
  ) {
    const event = {
      requestId: 1,
      commandName: "find",
      duration: 150,
      databaseName: "app",
      reply: { ok: 1 },
      ...overrides,
    } as CommandSucceededEvent;
    client.emit("commandSucceeded", event);
    return event;
  }

  it("skips fast queries below slowThreshold", async () => {
    const { client, commandCalls } = createMockClient();
    registerTraceMoleListener(client, { slowThreshold: 100, enabled: true });

    const tracer = trace.getTracer("test");
    await tracer.startActiveSpan("request", async (span) => {
      emitStarted(client);
      emitSucceeded(client, { duration: 50 });
      span.end();
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(commandCalls.length, 0);
    unregisterTraceMoleListener(client);
  });

  it("explains slow queries with the stored command", async () => {
    const { client, commandCalls } = createMockClient();
    const setAttributes = mock.fn();
    const span = trace.getTracer("test").startSpan("mongo.find");
    mock.method(span, "setAttributes", setAttributes);

    registerTraceMoleListener(client, { slowThreshold: 100, sampleRate: 1, enabled: true });

    mock.method(trace, "getActiveSpan", () => span);

    emitStarted(client, {
      command: { find: "users", filter: { status: "active" } },
    });
    emitSucceeded(client, { duration: 150 });

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(commandCalls.length, 1);
    assert.deepEqual((commandCalls[0] as { explain: unknown }).explain, {
      find: "users",
      filter: { status: "active" },
    });
    assert.equal(setAttributes.mock.calls.length, 1);
    unregisterTraceMoleListener(client);
    span.end();
  });

  it("skips system commands", async () => {
    const { client, commandCalls } = createMockClient();
    registerTraceMoleListener(client, { enabled: true });

    emitStarted(client, { commandName: "ping", command: { ping: 1 } });
    emitSucceeded(client, { commandName: "ping", duration: 200 });

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(commandCalls.length, 0);
    unregisterTraceMoleListener(client);
  });

  it("is idempotent", () => {
    const { client } = createMockClient();
    registerTraceMoleListener(client, { enabled: true });
    registerTraceMoleListener(client, { enabled: true });
    assert.equal(client.listenerCount("commandStarted"), 1);
    unregisterTraceMoleListener(client);
  });
});
