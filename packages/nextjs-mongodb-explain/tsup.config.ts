import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts", "src/listener.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  external: ["@opentelemetry/api", "mongodb"],
});
