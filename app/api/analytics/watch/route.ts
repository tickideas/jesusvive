/**
 * Anonymous viewer telemetry for the watch pages.
 *
 * Client sends:
 *   POST { event: 'start' | 'ping' | 'end',
 *          sessionId, cellId, referrer?, utm{Source,Medium,Campaign,Content}?,
 *          isMobile? }
 *
 * All three events upsert on sessionId. We can't assume `start` arrives
 * first: on slow mobile networks the initial POST competes with HLS
 * segment fetches, and `end` rides on sendBeacon which fires during
 * pagehide. So:
 *
 * - `start`: INSERT row; on conflict, leave existing row alone.
 * - `ping` : INSERT minimal row; on conflict, refresh last_heartbeat_at.
 * - `end`  : INSERT minimal row; on conflict, stamp ended_at +
 *            last_heartbeat_at.
 *
 * Fire-and-forget from the client (sendBeacon for `end`). The endpoint
 * returns 204 on every code path and never throws back at the client —
 * analytics must never disrupt the watch experience.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { watchSessions } from '@/lib/schema';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import { intEnv } from '@/lib/env';
import {
  isOriginAllowed,
  isValidCellId,
  isValidSessionId,
  isWatchEvent,
  sanitizeString,
} from './validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = intEnv('WATCH_ANALYTICS_RATE_LIMIT_MAX', 240);
const RATE_LIMIT_WINDOW_MS = intEnv(
  'WATCH_ANALYTICS_RATE_LIMIT_WINDOW_MS',
  60_000,
);
// Global cap for traffic with no resolvable client IP. Without this, a
// misconfigured proxy degrades to per-sessionId buckets, and since sessionId
// is client-controlled an attacker can fake unique ids forever — effectively
// no rate limit at all. This shared bucket caps the *total* IP-less write
// volume per minute across the whole service.
const RATE_LIMIT_NULL_IP_MAX = intEnv(
  'WATCH_ANALYTICS_NULL_IP_RATE_LIMIT_MAX',
  600,
);

// Optional CSRF-ish origin check. When unset (dev/staging), accept any
// origin so local testing still works. In production set this to your
// public origin, e.g. `https://jesusvive.church`. Comma-separated list ok.
const ALLOWED_ORIGINS = (process.env.WATCH_ANALYTICS_ALLOWED_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

let warnedMissingIp = false;
function warnMissingIpOnce(): void {
  if (warnedMissingIp) return;
  warnedMissingIp = true;
  console.warn(
    '[watch-analytics] clientIp() returned null; falling back to sessionId ' +
      'as rate-limit key. Verify TRUST_PROXY=1 and that the reverse proxy ' +
      'forwards a real client IP (CF-Connecting-IP, X-Forwarded-For, etc).',
  );
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
  // Reject foreign origins silently with 204 — same status as everything
  // else so a probe can't distinguish "blocked" from "accepted".
  if (
    !isOriginAllowed(
      ALLOWED_ORIGINS,
      req.headers.get('origin'),
      req.headers.get('referer'),
    )
  ) {
    return new NextResponse(null, { status: 204 });
  }

  // Parse + validate payload BEFORE rate limiting, so we can use sessionId
  // as a fallback bucket key when the request has no resolvable client IP.
  // (Without that fallback, every IP-less client would share a single
  // 'unknown' bucket and starve each other under normal traffic.)
  const payload = await readPayload(req);
  if (!payload) return new NextResponse(null, { status: 204 });

  const { event, sessionId, cellId } = payload;
  if (
    !isWatchEvent(event) ||
    !isValidSessionId(sessionId) ||
    !isValidCellId(cellId)
  ) {
    return new NextResponse(null, { status: 204 });
  }

  const ip = clientIp(req);
  if (!ip) warnMissingIpOnce();
  // Two-stage rate limit when IP is unknown:
  //   (a) per-session bucket: stops one runaway tab from spamming;
  //   (b) global IP-less bucket: caps total spoofable null-IP volume
  //       regardless of how many fresh sessionIds an attacker mints.
  // When IP is present we just bucket per-IP as before.
  const rlKey = `watch-analytics:${ip ?? `sid:${sessionId}`}`;
  const rl = rateLimit(rlKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return new NextResponse(null, { status: 204 });
  }
  if (!ip) {
    const globalRl = rateLimit(
      'watch-analytics:null-ip-global',
      RATE_LIMIT_NULL_IP_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!globalRl.allowed) {
      return new NextResponse(null, { status: 204 });
    }
  }

  try {
    const baseValues = {
      sessionId,
      cellId,
      referrer: sanitizeString(payload.referrer, 500),
      utmSource: sanitizeString(payload.utmSource, 200),
      utmMedium: sanitizeString(payload.utmMedium, 200),
      utmCampaign: sanitizeString(payload.utmCampaign, 200),
      utmContent: sanitizeString(payload.utmContent, 200),
      ipHash: hashIp(ip),
      userAgent: sanitizeString(req.headers.get('user-agent'), 500),
      isMobile: typeof payload.isMobile === 'boolean' ? payload.isMobile : null,
    };

    if (event === 'start') {
      // INSERT; if a late ping/end already created the row, leave it alone
      // (its last_heartbeat_at / ended_at are more recent than start metadata).
      await db
        .insert(watchSessions)
        .values(baseValues)
        .onConflictDoNothing({ target: watchSessions.sessionId });
    } else if (event === 'ping') {
      // Upsert. If start hasn't landed yet, this seeds the row so the session
      // is still counted; otherwise it just refreshes last_heartbeat_at.
      await db
        .insert(watchSessions)
        .values(baseValues)
        .onConflictDoUpdate({
          target: watchSessions.sessionId,
          set: { lastHeartbeatAt: sql`now()` },
        });
    } else {
      // event === 'end'
      await db
        .insert(watchSessions)
        .values({ ...baseValues, endedAt: sql`now()` })
        .onConflictDoUpdate({
          target: watchSessions.sessionId,
          set: { endedAt: sql`now()`, lastHeartbeatAt: sql`now()` },
        });
    }
  } catch (err) {
    console.error('[watch-analytics] insert/update failed:', err);
    // Swallow: analytics must not impact the watch page.
  }

  return new NextResponse(null, { status: 204 });
}
