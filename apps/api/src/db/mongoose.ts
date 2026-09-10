import mongoose from "mongoose";

import { getRequiredEnv } from "../env";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var sporeMongoose: CachedConnection | undefined;
}

const cached = globalThis.sporeMongoose ?? {
  conn: null,
  promise: null
};

globalThis.sporeMongoose = cached;

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  cached.promise ??= mongoose.connect(getRequiredEnv("MONGODB_URI"), {
    bufferCommands: false
  });

  cached.conn = await cached.promise;

  return cached.conn;
}
