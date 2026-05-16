/**
 * Retention sweep for watch_sessions.
 *
 * Triggered by an external scheduler (Dokploy cron / cron-job.org) with the
 * same shared secret used by the reminders cron. Deletes rows older than
 * WATCH_SESSIONS_RETENTION_DAYS (default: 90). Idempotent.
 *
 * Recommended schedule: once a day.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://jesusvive.church/api/cron/cleanup-watch-sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { watchSessions } from '@/lib/schema';
import { intEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = intEnv('WATCH_SESSIONS_RETENTION_DAYS', 90);
const BATCH_SIZE = intEnv('WATCH_SESSIONS_CLEANUP_BATCH', 5000);
const MAX_BATCHES = intEnv('WATCH_SESSIONS_CLEANUP_MAX_BATCHES', 100);

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Batch delete with LIMIT to keep lock duration and memory bounded. Each
  // batch is its own transaction, so other queries can interleave. We cap
  // the total batches per invocation as a safety so a runaway cron can't
  // hold connections forever — if there's more to delete, the next scheduled
  // run picks it up.
  //
  // The query uses a CTE so we get a deterministic { deleted: int } row
  // back instead of depending on the undocumented `result.count` shape
  // that postgres-js leaks through drizzle's `db.execute`. Table and
  // column names are interpolated from the schema so a rename in
  // lib/schema.ts surfaces as a type error here.
  let totalDeleted = 0;
  let batches = 0;
  while (batches < MAX_BATCHES) {
    const rows = (await db.execute(sql`
      with deleted as (
        delete from ${watchSessions}
        where ${watchSessions.id} in (
          select ${watchSessions.id} from ${watchSessions}
          where ${watchSessions.startedAt} < ${cutoff}
          limit ${BATCH_SIZE}
        )
        returning 1
      )
      select count(*)::int as deleted from deleted
    `)) as unknown as Array<{ deleted: number }>;

    const affected = rows[0]?.deleted;
    if (typeof affected !== 'number') {
      // The driver returned an unexpected shape. Fail loud so a silent
      // "deleted 0, exit" can't hide an outage.
      throw new Error(
        '[cleanup-watch-sessions] driver returned unexpected shape; aborting',
      );
    }
    totalDeleted += affected;
    batches += 1;
    if (affected < BATCH_SIZE) break;
  }

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    retentionDays: RETENTION_DAYS,
    deleted: totalDeleted,
    batches,
    batchSize: BATCH_SIZE,
    truncated: batches >= MAX_BATCHES,
  });
}
