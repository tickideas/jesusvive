import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';
import { registrationSchema } from '@/lib/validations';
import { resolveCellForGenericRoute } from '@/lib/cells';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export async function POST(req: NextRequest) {
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { error: first?.message ?? 'Dados inválidos.' },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const cellId = data.cellId || resolveCellForGenericRoute(data.whatsapp);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;
  const userAgent = req.headers.get('user-agent') || null;

  try {
    await db.insert(registrations).values({
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

    // TODO: Trigger WhatsApp confirmation template via Business API
    // TODO: Trigger email confirmation via Resend
    // TODO: Schedule 48h / 24h / 1h reminders

    return NextResponse.json({ ok: true, cellId }, { status: 200 });
  } catch (err) {
    console.error('Registration insert failed:', err);
    return NextResponse.json(
      { error: 'Não foi possível concluir a inscrição. Tente novamente.' },
      { status: 500 },
    );
  }
}
