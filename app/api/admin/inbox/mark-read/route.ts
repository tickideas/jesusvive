/**
 * Mark all inbound messages from a given phone as read.
 * Auth via middleware.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { whatsappMessages } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { whatsapp } = (await req.json().catch(() => ({}))) as {
    whatsapp?: string;
  };
  if (!whatsapp) {
    return NextResponse.json({ error: 'whatsapp required' }, { status: 400 });
  }
  await db
    .update(whatsappMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(whatsappMessages.whatsapp, whatsapp),
        eq(whatsappMessages.direction, 'in'),
        isNull(whatsappMessages.readAt),
      ),
    );
  return NextResponse.json({ ok: true });
}
