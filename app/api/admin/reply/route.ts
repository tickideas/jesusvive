/**
 * Admin: send a free-form WhatsApp reply to a customer.
 *
 * Free-form messages are only allowed inside Meta's 24h customer service
 * window — i.e. if the customer has sent us a message in the last 24 hours.
 * We enforce that server-side: refuse with 409 if the last inbound is older.
 *
 * Auth via middleware.ts (basic auth on /api/admin/*).
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { db } from '@/lib/db';
import { whatsappMessages } from '@/lib/schema';
import { sendWhatsAppText } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  whatsapp: z
    .string()
    .min(8)
    .refine((v) => {
      try {
        return isValidPhoneNumber(v);
      } catch {
        return false;
      }
    }, 'Invalid phone'),
  body: z.string().trim().min(1).max(1500),
});

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const to = parsePhoneNumber(parsed.data.whatsapp).number;
  const body = parsed.data.body;

  // Verify the 24h customer service window is open.
  const [lastInbound] = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.whatsapp, to),
        eq(whatsappMessages.direction, 'in'),
      ),
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  if (!lastInbound) {
    return NextResponse.json(
      {
        error:
          'No inbound message from this number. Free-form replies require the customer to message first; otherwise use an approved template.',
      },
      { status: 409 },
    );
  }
  const ageMs = Date.now() - lastInbound.createdAt.getTime();
  if (ageMs > WINDOW_MS) {
    return NextResponse.json(
      {
        error: `Customer service window expired (last inbound ${Math.round(
          ageMs / 3600_000,
        )}h ago). Send an approved template instead.`,
      },
      { status: 409 },
    );
  }

  const result = await sendWhatsAppText(to, body);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Send failed' },
      { status: 502 },
    );
  }

  await db.insert(whatsappMessages).values({
    whatsapp: to,
    direction: 'out',
    body,
    twilioSid: result.sid || null,
    status: 'queued',
  });

  return NextResponse.json({ ok: true, sid: result.sid });
}
