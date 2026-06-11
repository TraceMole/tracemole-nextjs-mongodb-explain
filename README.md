# @tracemole/nextjs-mongodb-explain

Attach `executionStats` from MongoDB explain queries to your active OpenTelemetry spans. This allows APM dashboards (such as TraceMole) to render database execution plans, highlighting index usage, document scan ratios, and collection scan warnings in query waterfalls.

## Installation

```sh
npm install @tracemole/nextjs-mongodb-explain
```

Make sure you also have `@opentelemetry/api` and `mongodb` installed in your project.

## Usage

### 1. Wrap query executions with `withMongoExplain`

The easiest way to measure query efficiency is to wrap your database commands with `withMongoExplain`:

```ts
import { withMongoExplain } from "@tracemole/nextjs-mongodb-explain";

const users = await withMongoExplain({
  // Run your actual query instrumented by OTel
  run: () => db.collection("users").find({ status: "active" }).limit(10).toArray(),

  // Run the same query filter with .explain("executionStats")
  explain: () =>
    db.collection("users").find({ status: "active" }).limit(10).explain("executionStats"),

  // Optional label shown in the APM trace
  label: "find active users",
});
```

### 2. Manual Attachment

If you already have an explain result block, you can attach it manually to the active span:

```ts
import {
  attachExplainToActiveSpan,
  parseExplainStats,
} from "@tracemole/nextjs-mongodb-explain";

const explainResult = await collection.find(filter).explain("executionStats");
const stats = parseExplainStats(explainResult);

// Attaches database explain attributes to the current span
await attachExplainToActiveSpan(stats);
```

## Features

- **Zero overhead in production**: Set `TRACE_MOLE_MONGO_EXPLAIN=0` to skip the explain queries entirely in production environments.
- **Automatic Parsing**: Formats verbose MongoDB execution plan trees into standardized `db.mongodb.explain.*` OpenTelemetry span attributes.
- **Supports pipelines**: Works with both `find` operations and `aggregate` stages.

## License

[Apache-2.0](LICENSE)
