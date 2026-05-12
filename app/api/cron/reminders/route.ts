/**
 * WhatsApp reminders cron.
 *
 * Triggered by an external scheduler (Dokploy cron / cron-job.org) with a
 * shared secret. Sends 48h / 24h / 1h reminder templates for the upcoming
 * event and stamps each reminder column on success.
 *
 * Recommended schedule: every 15 minutes. Idempotent — the *_sent_at columns
 * guarantee no duplicate sends.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://jesusvive.church/api/cron/reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';
import { sendWhatsAppTemplate } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_DATE =
  process.env.NEXT_PUBLIC_EVENT_DATE || '2026-05-16T19:00:00-03:00';

interface Window {
  label: '48h' | '24h' | '1h';
  sentAtCol: PgColumn;
  setSent: (now: Date) => Partial<typeof registrations.$inferInsert>;
  /** Window opens at T-<hoursBefore> and closes at the event start. */
  hoursBefore: number;
  contentSidEnv:
    | 'TWILIO_TEMPLATE_REMINDER_48H_SID'
    | 'TWILIO_TEMPLATE_REMINDER_24H_SID'
    | 'TWILIO_TEMPLATE_REMINDER_1H_SID';
  /** Template variable {{2}} — friendly time-until label (pt-BR). */
  untilLabel: string;
}

const WINDOWS: Window[] = [
  {
    label: '48h',
    sentAtCol: registrations.reminder48hSentAt,
    setSent: (now) => ({ reminder48hSentAt: now }),
    hoursBefore: 48,
    contentSidEnv: 'TWILIO_TEMPLATE_REMINDER_48H_SID',
    untilLabel: '2 dias',
  },
  {
    label: '24h',
    sentAtCol: registrations.reminder24hSentAt,
    setSent: (now) => ({ reminder24hSentAt: now }),
    hoursBefore: 24,
    contentSidEnv: 'TWILIO_TEMPLATE_REMINDER_24H_SID',
    untilLabel: '1 dia',
  },
  {
    label: '1h',
    sentAtCol: registrations.reminder1hSentAt,
    setSent: (now) => ({ reminder1hSentAt: now }),
    hoursBefore: 1,
    contentSidEnv: 'TWILIO_TEMPLATE_REMINDER_1H_SID',
    untilLabel: '1 hora',
  },
];

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eventAt = new Date(EVENT_DATE);
  const hoursUntilEvent =
    (eventAt.getTime() - Date.now()) / (60 * 60 * 1000);

  const stats: Record<string, { eligible: number; sent: number; failed: number }> = {};

  for (const w of WINDOWS) {
    stats[w.label] = { eligible: 0, sent: 0, failed: 0 };

    // Window is open from T-<hoursBefore> until T-0.
    if (hoursUntilEvent > w.hoursBefore || hoursUntilEvent < 0) continue;

    const contentSid = process.env[w.contentSidEnv];
    if (!contentSid) {
      console.warn(`[cron] ${w.label}: missing ${w.contentSidEnv}, skipping`);
      continue;
    }

    const rows = await db
      .select({
        id: registrations.id,
        firstName: registrations.firstName,
        whatsapp: registrations.whatsapp,
      })
      .from(registrations)
      .where(and(isNull(w.sentAtCol)))
      .limit(500); // safety cap per run

    stats[w.label].eligible = rows.length;

    for (const row of rows) {
      const result = await sendWhatsAppTemplate({
        to: row.whatsapp,
        contentSid,
        variables: { '1': row.firstName, '2': w.untilLabel },
      });
      if (result.ok) {
        await db
          .update(registrations)
          .set(w.setSent(new Date()))
          .where(eq(registrations.id, row.id));
        stats[w.label].sent++;
      } else if (!result.skipped) {
        stats[w.label].failed++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    eventAt: eventAt.toISOString(),
    hoursUntilEvent: Number(hoursUntilEvent.toFixed(2)),
    stats,
  });
}
