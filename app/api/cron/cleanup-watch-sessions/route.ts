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
import { lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { watchSessions } from '@/lib/schema';
import { intEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = intEnv('WATCH_SESSIONS_RETENTION_DAYS', 90);

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
  const deleted = await db
    .delete(watchSessions)
    .where(lt(watchSessions.startedAt, cutoff))
    .returning({ id: watchSessions.id });

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    retentionDays: RETENTION_DAYS,
    deleted: deleted.length,
  });
}
