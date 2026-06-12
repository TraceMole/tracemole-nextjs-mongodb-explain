# @tracemole/nextjs-mongodb-explain

Attach `executionStats` from MongoDB explain queries to your OpenTelemetry spans. This allows APM dashboards (such as TraceMole) to render database execution plans, highlighting index usage, document scan ratios, and collection scan warnings in query waterfalls.

## Installation

```sh
npm install @tracemole/nextjs-mongodb-explain
```

Make sure you also have `@opentelemetry/api`, `mongodb`, and MongoDB OpenTelemetry instrumentation installed in your project.

## Usage

### 1. Command listener (recommended — zero per-query wrapping)

Register once on your `MongoClient`. Slow queries are explained automatically and stats are attached to the active MongoDB driver span.

```ts
import { createTraceMoleClient } from "@tracemole/nextjs-mongodb-explain";

// monitorCommands defaults to true
const client = createTraceMoleClient(process.env.MONGODB_URI!, {
  slowThreshold: 50, // ms — only explain queries slower than this
});
```

For an existing client, register the listener and ensure `monitorCommands: true` was set at construction:

```ts
import { MongoClient } from "mongodb";
import { registerTraceMoleListener } from "@tracemole/nextjs-mongodb-explain";

const client = new MongoClient(uri, { monitorCommands: true });
registerTraceMoleListener(client, { slowThreshold: 100 });
```

**Next.js example** (`instrumentation.ts`):

```ts
import { createTraceMoleClient } from "@tracemole/nextjs-mongodb-explain";

const client = createTraceMoleClient(process.env.MONGODB_URI!, {
  slowThreshold: 50,
});

// expose via your existing MongoDB singleton / global
globalThis._mongoClient = client;
```

Register the listener before or alongside `@opentelemetry/instrumentation-mongodb` so the driver span is active when commands start.

### 2. Force explain a specific query (`withMongoExplain`)

Use this escape hatch when you want explain stats regardless of the slow-query threshold:

```ts
import { withMongoExplain } from "@tracemole/nextjs-mongodb-explain";

const users = await withMongoExplain({
  run: () => db.collection("users").find({ status: "active" }).limit(10).toArray(),
  explain: () =>
    db.collection("users").find({ status: "active" }).limit(10).explain("executionStats"),
  label: "find active users",
});
```

### 3. Collection proxy (when command monitoring is unavailable)

Wrap a collection to auto-explain read operations at the callsite:

```ts
import { traceMoleCollection } from "@tracemole/nextjs-mongodb-explain";

const users = traceMoleCollection(db, "users");
const active = await users.find({ status: "active" }).toArray();
```

Intercepted methods: `find`, `aggregate`, `countDocuments`, `distinct`, `findOne`.

### 4. Manual attachment

If you already have an explain result, attach it manually:

```ts
import {
  attachExplainToActiveSpan,
  parseExplainStats,
} from "@tracemole/nextjs-mongodb-explain";

const explainResult = await collection.find(filter).explain("executionStats");
const stats = parseExplainStats(explainResult);
await attachExplainToActiveSpan(stats);
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `TRACE_MOLE_MONGO_EXPLAIN=0` | enabled | Kill switch — disables all explain queries |
| `slowThreshold` | `100` | Listener: only explain queries slower than this (ms) |
| `sampleRate` | `1` | Fraction of qualifying queries to explain (0–1) |
| `monitorCommands` | `true` | Required for the command listener (`createTraceMoleClient` sets this) |

## Span attributes

Stats are written as standardized OpenTelemetry attributes under the `db.mongodb.explain.*` prefix. Use the exported constants instead of hand-typing names:

```ts
import { MONGO_EXPLAIN_ATTR } from "@tracemole/nextjs-mongodb-explain";

// MONGO_EXPLAIN_ATTR.operation       → "db.mongodb.explain.operation"
// MONGO_EXPLAIN_ATTR.docsExamined    → "db.mongodb.explain.docs_examined"
// MONGO_EXPLAIN_ATTR.scanType        → "db.mongodb.explain.scan_type"
// ...
```

Browser-safe attribute helpers are available from `@tracemole/nextjs-mongodb-explain/client`.

## Features

- **Zero callsite instrumentation** with the command listener middleware
- **Zero overhead in production**: set `TRACE_MOLE_MONGO_EXPLAIN=0` to skip explain queries entirely
- **Automatic parsing**: formats verbose MongoDB execution plan trees into standardized span attributes
- **Supports pipelines**: works with `find`, `aggregate`, and other explainable operations

## License

[Apache-2.0](LICENSE)
