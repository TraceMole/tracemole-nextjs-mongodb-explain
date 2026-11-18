# @tracemole/next

Two-line OpenTelemetry setup for Next.js apps that use MongoDB or Mongoose. Sends traces to [TraceMole](https://www.tracemole.com) (or any OTLP/HTTP backend) and attaches MongoDB `explain` stats — docs scanned vs returned, index used, `COLLSCAN` — to your query spans, without changing your database code.

## Setup

```sh
npm install @tracemole/next
```

```ts
// instrumentation.ts (project root, or src/ if you use it)
export { register } from "@tracemole/next";
```

```env
TRACEMOLE_API_KEY=tm_live_...
```

That's it. Run your app, hit a page or API route, and open your project in TraceMole.

Requirements: Next.js 15+ (no `next.config` change needed) and Node.js 22.15+.

## What you get

- Next.js request spans (`GET /api/orders`, route handlers, server components) — created by Next.js itself.
- Outgoing `fetch` / HTTP calls.
- Every MongoDB command inside a request (`find orders`, `aggregate`, …), from the official driver or Mongoose.
- **Explain stats on slow queries** (dev by default): the SDK turns on command monitoring for every `MongoClient` your app creates and runs `explain("executionStats")` for queries slower than the threshold. The explain call itself is not traced.

## Options

```ts
// instrumentation.ts
import { registerTraceMole } from "@tracemole/next";

export const register = () =>
  registerTraceMole({
    serviceName: "checkout-api",
    explain: {
      slowThresholdMs: 50, // default 100
      sampleRate: 0.5, // default 1
      inProduction: false, // default false: explain re-runs the query
    },
  });
```

| Option | Env var | Default |
|---|---|---|
| `apiKey` | `TRACEMOLE_API_KEY` | — (tracing is off without it) |
| `endpoint` | `TRACEMOLE_ENDPOINT` | `https://tracemole-ingest.faisalhusain1320.workers.dev/v1/traces` |
| `serviceName` | `OTEL_SERVICE_NAME` | your `package.json` name |
| `explain` | `TRACE_MOLE_MONGO_EXPLAIN=0` / `1` | on in dev, off in production |
| `debug` | — | on outside production |

`explain: false` turns explain off entirely.

## Deploying

- **Vercel**: spans are flushed when each request finishes, using Vercel's `waitUntil`, so they aren't lost when the function freezes.
- **Docker / VMs / `next start`**: spans are batched and sent every few seconds.
- **Edge runtime**: `register()` does nothing there (MongoDB drivers can't run on Edge); Node.js routes in the same app are still traced.

## Not using TraceMole?

It's plain OTLP/HTTP (protobuf). Point `endpoint` at any OpenTelemetry collector or vendor and set `apiKey` to whatever your backend expects in the `x-api-key` header, or use [`@tracemole/nextjs-mongodb-explain`](../nextjs-mongodb-explain) with your own OpenTelemetry setup.

## License

Apache-2.0
