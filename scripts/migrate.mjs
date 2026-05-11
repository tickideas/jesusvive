// Production migration runner.
// Executed on container start before the Next server boots.
// Idempotent: drizzle tracks applied migrations in `__drizzle_migrations`.
//
// Safe under concurrent boots: drizzle-orm/postgres-js/migrator acquires a
// Postgres advisory lock around the migration run, so multiple web replicas
// starting at once will not double-apply migrations — the losers no-op.
// Confirmed for drizzle-orm >= 0.30 (currently pinned to 0.45.x in
// package.json). If you upgrade past a major version, re-verify this
// behavior or wrap the migrate() call in your own pg_advisory_lock.

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql);

let shuttingDown = false;
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true; // set before awaiting to guard re-entry from a second signal
  try {
    await sql.end({ timeout: 5 });
  } catch {
    // ignore
  }
  process.exit(code);
}
process.on('SIGTERM', () => shutdown(143));
process.on('SIGINT', () => shutdown(130));

try {
  console.log('[migrate] Applying migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] Done.');
  await sql.end({ timeout: 5 });
} catch (err) {
  console.error('[migrate] Failed:', err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}
