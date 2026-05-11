import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';
import { registrationSchema } from '@/lib/validations';
import { resolveCellForGenericRoute } from '@/lib/cells';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import { intEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = intEnv('REGISTER_RATE_LIMIT_MAX', 5);
const RATE_LIMIT_WINDOW_MS = intEnv('REGISTER_RATE_LIMIT_WINDOW_MS', 60_000);
const DEDUP_WINDOW_MS = intEnv('REGISTER_DEDUP_WINDOW_MS', 10 * 60_000);

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`register:${ip ?? 'unknown'}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns instantes.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    );
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? 'Dados inválidos.' },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const cellId = data.cellId || resolveCellForGenericRoute(data.whatsapp);

  const userAgent = req.headers.get('user-agent') || null;

  try {
    // Dedup: same whatsapp + source within the dedup window is treated as
    // success. A Postgres transaction-scoped advisory lock keyed on
    // (whatsapp, source) serializes concurrent requests so the SELECT-then-
    // INSERT can't race.
    const lockKey = `${data.whatsapp}|${data.source}`;
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const deduped = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const existing = await tx
        .select({ id: registrations.id })
        .from(registrations)
        .where(
          and(
            eq(registrations.whatsapp, data.whatsapp),
            eq(registrations.source, data.source),
            gt(registrations.createdAt, since),
          ),
        )
        .limit(1);
      if (existing.length > 0) return true;

      await tx.insert(registrations).values({
        firstName: data.firstName,
        lastName: data.lastName,
        whatsapp: data.whatsapp,
        email: data.email || null,
        city: data.city,
        cellId,
        language: data.language,
        lgpdConsent: data.lgpdConsent,
        lgpdConsentAt: new Date(),
        source: data.source,
        utmSource: data.utmSource || null,
        utmMedium: data.utmMedium || null,
        utmCampaign: data.utmCampaign || null,
        utmContent: data.utmContent || null,
        ipHash: hashIp(ip),
        userAgent,
      });
      return false;
    });

    // TODO: Trigger WhatsApp confirmation template via Business API
    // TODO: Trigger email confirmation via Resend
    // TODO: Schedule 48h / 24h / 1h reminders

    return NextResponse.json({ ok: true, cellId, deduped }, { status: 200 });
  } catch (err) {
    console.error('Registration insert failed:', err);
    return NextResponse.json(
      { error: 'Não foi possível concluir a inscrição. Tente novamente.' },
      { status: 500 },
    );
  }
}
