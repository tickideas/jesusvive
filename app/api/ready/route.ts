import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Readiness probe: runs `SELECT 1` against the shared pool. At the compose
// 15s healthcheck interval this is one short-lived query on the main pool;
// if probes are increased significantly, consider a dedicated single-conn
// pool so saturation can't starve real traffic out of `max: 10`.
//
// Rate-limited per IP to prevent unauthenticated DB-touching probe spam.
function isLoopback(ip: string | null): boolean {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.');
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  // Bypass rate limit for loopback so container/orchestrator probes never
  // get throttled. Real client probes still go through the limiter.
  if (!isLoopback(ip)) {
    const rl = rateLimit(`ready:${ip ?? 'unknown'}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 });
    }
  }

  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('Readiness check failed:', err);
    return NextResponse.json(
      { ok: false, error: 'database unavailable' },
      { status: 503 },
    );
  }
}
