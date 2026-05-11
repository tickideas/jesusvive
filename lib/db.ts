import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Db };

function getDb(): Db {
  if (globalForDb.__db) return globalForDb.__db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = postgres(connectionString, {
    max: 10, // max concurrent connections in this pool
    idle_timeout: 20, // seconds an idle connection is kept before close
  });

  globalForDb.__db = drizzle(client, { schema });
  return globalForDb.__db;
}

// Proxy that defers connection until first DB call — keeps the build hermetic
// and avoids opening a pool at import time. Only `get` is trapped because
// drizzle's API surface is method/property reads; do not call
// `Object.assign(db, ...)` or `db.something = x` on this export.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const target = getDb() as unknown as Record<string | symbol, unknown>;
    return target[prop];
  },
});
