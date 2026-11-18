# TraceMole JavaScript SDKs

Open-source packages that run inside your app. They use standard OpenTelemetry and send OTLP, so you can use them with [TraceMole](https://www.tracemole.com) or any other backend.

| Package | What it does |
|---|---|
| [`@tracemole/next`](packages/next) | Two-line tracing setup for Next.js + MongoDB/Mongoose, with automatic explain stats |
| [`@tracemole/nextjs-mongodb-explain`](packages/nextjs-mongodb-explain) | Attach MongoDB `explain` stats to OpenTelemetry spans in any Node app |

## Quick start (Next.js)

```sh
npm install @tracemole/next
```

```ts
// instrumentation.ts
export { register } from "@tracemole/next";
```

```env
TRACEMOLE_API_KEY=tm_live_...
```

## Development

```sh
npm install
npm run check-types
npm test
npm run build
```

Releases use [Changesets](https://github.com/changesets/changesets): add `npx changeset` to your PR; merging the generated "Version packages" PR publishes to npm.

## License

Apache-2.0
