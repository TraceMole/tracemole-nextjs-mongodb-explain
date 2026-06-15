export {
  MONGO_EXPLAIN_ATTR,
  MONGO_EXPLAIN_PREFIX,
  explainAttributes,
  hasMongoExplainAttributes,
  readExplainFromAttributes,
} from "./attributes";
export type { MongoExplainAttributeKey, MongoExplainAttributeValue } from "./attributes";
export { attachExplainToActiveSpan, attachExplainToSpan } from "./attach";
export { createTraceMoleClient } from "./create-client";
export type { CreateTraceMoleClientOptions } from "./create-client";
export { isExplainEnabled } from "./enabled";
export {
  registerTraceMoleListener,
  unregisterTraceMoleListener,
} from "./listener";
export type { TraceMoleListenerOptions } from "./listener";
export { parseExplainStats } from "./parse";
export { traceMoleCollection } from "./proxy";
export type { TraceMoleProxyOptions } from "./proxy";
export type { MongoExplainStats } from "./types";
export { withMongoExplain } from "./with-mongo-explain";
export type { WithMongoExplainOptions } from "./with-mongo-explain";
