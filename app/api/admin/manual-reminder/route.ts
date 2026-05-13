/**
 * Stamps the appropriate reminder_*_sent_at column for a registration so
 * the automated cron does not later send the same reminder again.
 *
 * Called by the /admin/reminders page after the operator clicks the
 * "Marcar como enviado" button — i.e. after they manually opened WhatsApp
 * and sent the message themselves.
 *
 * Auth: protected by the admin basic-auth middleware (same as the rest
 * of /api/admin/*).
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';
import { windowByLabel } from '@/lib/manual-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  id: z.string().uuid(),
  window: z.enum(['48h', '24h', '1h']),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { id, window } = parsed.data;
  const def = windowByLabel(window);
  if (!def) {
    return NextResponse.json({ error: 'Unknown window' }, { status: 400 });
  }

  const result = await db
    .update(registrations)
    .set(def.setSent(new Date()))
    .where(eq(registrations.id, id))
    .returning({ id: registrations.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
