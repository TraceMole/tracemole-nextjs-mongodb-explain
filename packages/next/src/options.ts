/** Default TraceMole ingest endpoint (OTLP/HTTP traces). */
export const DEFAULT_ENDPOINT = "https://tracemole-ingest.faisalhusain1320.workers.dev/v1/traces";

export type ExplainOptions = {
  /** Only explain queries slower than this many ms. Default: 100. */
  slowThresholdMs?: number;
  /** Fraction of slow queries to explain, 0–1. Default: 1. */
  sampleRate?: number;
  /**
   * Run explain when NODE_ENV=production. Explain re-executes the query, so it
   * is off in production by default. Default: false.
   */
  inProduction?: boolean;
};

export type TraceMoleOptions = {
  /** TraceMole API key. Default: env TRACEMOLE_API_KEY (or TRACE_MOLE_API_KEY). */
  apiKey?: string;
  /** OTLP/HTTP traces URL. Default: env TRACEMOLE_ENDPOINT, else TraceMole cloud. */
  endpoint?: string;
  /** Service name on every span. Default: env OTEL_SERVICE_NAME, else npm package name. */
  serviceName?: string;
  /** MongoDB explain stats on query spans, or `false` to turn off. */
  explain?: ExplainOptions | false;
  /** Print setup info and warnings. Default: true outside production. */
  debug?: boolean;
};

export type ResolvedOptions = {
  apiKey: string | undefined;
  endpoint: string;
  serviceName: string;
  explain:
    | { enabled: true; slowThresholdMs: number; sampleRate: number }
    | { enabled: false; reason: string };
  debug: boolean;
  isProduction: boolean;
};

type Env = Record<string, string | undefined>;

function explainFromEnv(env: Env): boolean | undefined {
  const raw = env.TRACE_MOLE_MONGO_EXPLAIN ?? env.TRACEMOLE_MONGO_EXPLAIN;
  if (raw == null || raw === "") return undefined;
  return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

export function resolveOptions(options: TraceMoleOptions = {}, env: Env = process.env): ResolvedOptions {
  const isProduction = env.NODE_ENV === "production";

  let explain: ResolvedOptions["explain"];
  const envExplain = explainFromEnv(env);
  if (options.explain === false) {
    explain = { enabled: false, reason: "explain: false" };
  } else if (envExplain === false) {
    explain = { enabled: false, reason: "TRACE_MOLE_MONGO_EXPLAIN=0" };
  } else if (isProduction && !options.explain?.inProduction && envExplain !== true) {
    explain = { enabled: false, reason: "off in production (set explain.inProduction to enable)" };
  } else {
    explain = {
      enabled: true,
      slowThresholdMs: options.explain?.slowThresholdMs ?? 100,
      sampleRate: Math.min(1, Math.max(0, options.explain?.sampleRate ?? 1)),
    };
  }

  return {
    apiKey: options.apiKey ?? env.TRACEMOLE_API_KEY ?? env.TRACE_MOLE_API_KEY,
    endpoint: options.endpoint ?? env.TRACEMOLE_ENDPOINT ?? DEFAULT_ENDPOINT,
    serviceName: options.serviceName ?? env.OTEL_SERVICE_NAME ?? env.npm_package_name ?? "nextjs-app",
    explain,
    debug: options.debug ?? !isProduction,
    isProduction,
  };
}
