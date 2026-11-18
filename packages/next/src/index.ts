import type { TraceMoleOptions } from "./options";

export type { ExplainOptions, TraceMoleOptions } from "./options";
export { DEFAULT_ENDPOINT } from "./options";

/**
 * Start TraceMole tracing. Call from `register()` in `instrumentation.ts`.
 * Does nothing in the Edge runtime (MongoDB drivers can't run there).
 */
export async function registerTraceMole(options: TraceMoleOptions = {}): Promise<void> {
  // Next.js inlines NEXT_RUNTIME at build time, so the Edge bundle drops this
  // branch and never tries to resolve the Node-only OpenTelemetry SDK.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTraceMole } = await import("./node");
    startTraceMole(options);
  }
}

/** Default options, ready to re-export: `export { register } from "@tracemole/next";` */
export async function register(): Promise<void> {
  await registerTraceMole();
}
