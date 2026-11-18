import { defineConfig } from "tsup";

export default defineConfig({
  // index.ts must stay free of Node-only imports: Next.js also compiles
  // instrumentation.ts for the Edge runtime. node.ts is loaded dynamically.
  entry: ["src/index.ts", "src/node.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node22",
  splitting: true,
  external: [/^@opentelemetry\//, "@tracemole/nextjs-mongodb-explain", "mongodb", "mongoose", "next"],
});
