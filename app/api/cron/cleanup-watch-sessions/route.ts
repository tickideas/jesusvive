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
  let totalDeleted = 0;
  let batches = 0;
  while (batches < MAX_BATCHES) {
    const result = await db.execute(sql`
      delete from watch_sessions
      where id in (
        select id from watch_sessions
        where started_at < ${cutoff}
        limit ${BATCH_SIZE}
      )
    `);
    // postgres-js exposes affected-row count on `count`. We don't pull
    // any returned rows back — just trust the driver-reported count.
    const affected = (result as unknown as { count?: number }).count ?? 0;
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
