export function isExplainEnabled(explicit?: boolean): boolean {
  if (explicit != null) return explicit;
  return process.env.TRACE_MOLE_MONGO_EXPLAIN !== "0";
}
