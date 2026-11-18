import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  isWrapped,
  type InstrumentationConfig,
} from "@opentelemetry/instrumentation";
// The /listener entry does not load the mongodb driver. Loading it here would
// happen before instrumentations are enabled and stop them patching the driver.
import { registerTraceMoleListener } from "@tracemole/nextjs-mongodb-explain/listener";
import type { MongoClient } from "mongodb";

export type MongoExplainInstrumentationConfig = InstrumentationConfig & {
  slowThresholdMs: number;
  sampleRate: number;
};

type MongoModule = { MongoClient?: { prototype: MongoClient } };

/**
 * Turns on command monitoring and the TraceMole explain listener for every
 * MongoClient the app creates (Mongoose included), so users don't have to
 * change their MongoDB code. Patches MongoClient.prototype.connect, which the
 * driver also calls on auto-connect.
 */
export class MongoExplainInstrumentation extends InstrumentationBase<MongoExplainInstrumentationConfig> {
  constructor(config: MongoExplainInstrumentationConfig) {
    super("@tracemole/mongodb-explain", "0.1.0", config);
  }

  protected init() {
    return [
      new InstrumentationNodeModuleDefinition(
        "mongodb",
        [">=6.0.0 <8"],
        (moduleExports: MongoModule) => {
          const proto = moduleExports.MongoClient?.prototype;
          if (proto && !isWrapped(proto.connect)) {
            this._wrap(proto, "connect", this.patchConnect());
          }
          return moduleExports;
        },
        (moduleExports: MongoModule) => {
          const proto = moduleExports?.MongoClient?.prototype;
          if (proto) this._unwrap(proto, "connect");
        },
      ),
    ];
  }

  private patchConnect() {
    const instrumentation = this;
    return (original: MongoClient["connect"]) =>
      function patchedConnect(this: MongoClient, ...args: unknown[]) {
        instrumentation.prepareClient(this);
        return (original as (...a: unknown[]) => Promise<MongoClient>).apply(this, args);
      };
  }

  prepareClient(client: MongoClient): void {
    try {
      // Read by each new connection, so it must be set before connecting.
      (client as unknown as { monitorCommands: boolean }).monitorCommands = true;
      const { slowThresholdMs, sampleRate } = this.getConfig();
      registerTraceMoleListener(client, { slowThreshold: slowThresholdMs, sampleRate, enabled: true });
    } catch (err) {
      this._diag.debug("could not prepare MongoClient for explain", err);
    }
  }
}
