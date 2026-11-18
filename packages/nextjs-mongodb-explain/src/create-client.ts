import { MongoClient, type MongoClientOptions } from "mongodb";
import { registerTraceMoleListener, type TraceMoleListenerOptions } from "./listener";

export type CreateTraceMoleClientOptions = MongoClientOptions & TraceMoleListenerOptions;

export function createTraceMoleClient(
  uri: string,
  options: CreateTraceMoleClientOptions = {},
): MongoClient {
  const {
    slowThreshold,
    sampleRate,
    enabled,
    monitorCommands,
    ...mongoOptions
  } = options;

  const client = new MongoClient(uri, {
    ...mongoOptions,
    monitorCommands: monitorCommands ?? true,
  });

  registerTraceMoleListener(client, { slowThreshold, sampleRate, enabled });
  return client;
}
