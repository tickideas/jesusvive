/**
 * Anonymous viewer telemetry for the watch pages.
 *
 * Client sends:
 *   POST { event: 'start' | 'ping' | 'end',
 *          sessionId, cellId, referrer?, utm{Source,Medium,Campaign,Content}?,
 *          isMobile? }
 *
 * - `start`: INSERT (or no-op if the sessionId already exists; client may
 *   double-fire on Strict-Mode remounts).
 * - `ping` : UPDATE last_heartbeat_at.
 * - `end`  : UPDATE ended_at + last_heartbeat_at.
 *
 * Fire-and-forget from the client (sendBeacon for `end`). The endpoint
 * returns 204 on the happy path and never throws back at the client —
 * analytics must never disrupt the watch experience.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { watchSessions } from '@/lib/schema';
import { CELL_CONFIG } from '@/lib/cells';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import { intEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = intEnv('WATCH_ANALYTICS_RATE_LIMIT_MAX', 240);
const RATE_LIMIT_WINDOW_MS = intEnv(
  'WATCH_ANALYTICS_RATE_LIMIT_WINDOW_MS',
  60_000,
);

const VALID_CELL_IDS = new Set(
  Object.values(CELL_CONFIG).map((c) => c.cellId),
);

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

function trim(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

interface Payload {
  event?: unknown;
  sessionId?: unknown;
  cellId?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  isMobile?: unknown;
}

async function readPayload(req: NextRequest): Promise<Payload | null> {
  // sendBeacon ships as text/plain; tolerate either content-type.
  const text = await req.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as Payload;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(
    `watch-analytics:${ip ?? 'unknown'}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rl.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await readPayload(req);
  if (!payload) return new NextResponse(null, { status: 204 });

  const event = payload.event;
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
  const cellId = typeof payload.cellId === 'string' ? payload.cellId : '';

  if (event !== 'start' && event !== 'ping' && event !== 'end') {
    return new NextResponse(null, { status: 204 });
  }
  if (!SESSION_ID_RE.test(sessionId)) {
    return new NextResponse(null, { status: 204 });
  }
  if (!VALID_CELL_IDS.has(cellId)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    if (event === 'start') {
      await db
        .insert(watchSessions)
        .values({
          sessionId,
          cellId,
          referrer: trim(payload.referrer, 500),
          utmSource: trim(payload.utmSource, 200),
          utmMedium: trim(payload.utmMedium, 200),
          utmCampaign: trim(payload.utmCampaign, 200),
          utmContent: trim(payload.utmContent, 200),
          ipHash: hashIp(ip),
          userAgent: trim(req.headers.get('user-agent'), 500),
          isMobile: typeof payload.isMobile === 'boolean' ? payload.isMobile : null,
        })
        .onConflictDoNothing({ target: watchSessions.sessionId });
    } else if (event === 'ping') {
      await db
        .update(watchSessions)
        .set({ lastHeartbeatAt: sql`now()` })
        .where(eq(watchSessions.sessionId, sessionId));
    } else if (event === 'end') {
      await db
        .update(watchSessions)
        .set({ endedAt: sql`now()`, lastHeartbeatAt: sql`now()` })
        .where(eq(watchSessions.sessionId, sessionId));
    }
  } catch (err) {
    console.error('[watch-analytics] insert/update failed:', err);
    // Swallow: analytics must not impact the watch page.
  }

  return new NextResponse(null, { status: 204 });
}
