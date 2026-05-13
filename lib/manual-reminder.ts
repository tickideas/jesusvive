/**
 * Manual WhatsApp reminder helpers.
 *
 * Fallback used when the Twilio API is unavailable (suspension, outage).
 * Generates a `wa.me` deep-link the operator can tap to open a chat with
 * the reminder message pre-filled, then send manually from their phone.
 *
 * The text mirrors the approved `jesusvive_lembrete` template content so
 * recipients see a consistent message whether it came through Twilio or
 * was sent manually.
 */

import { registrations } from '@/lib/schema';
import type { PgColumn } from 'drizzle-orm/pg-core';

export type ReminderWindow = '48h' | '24h' | '1h';

export interface WindowDef {
  label: ReminderWindow;
  hoursBefore: number;
  untilLabel: string; // matches template var {{2}}: "2 dias" / "1 dia" / "1 hora"
  sentAtCol: PgColumn;
  setSent: (now: Date) => Partial<typeof registrations.$inferInsert>;
}

export const WINDOWS: WindowDef[] = [
  {
    label: '48h',
    hoursBefore: 48,
    untilLabel: '2 dias',
    sentAtCol: registrations.reminder48hSentAt,
    setSent: (now) => ({ reminder48hSentAt: now }),
  },
  {
    label: '24h',
    hoursBefore: 24,
    untilLabel: '1 dia',
    sentAtCol: registrations.reminder24hSentAt,
    setSent: (now) => ({ reminder24hSentAt: now }),
  },
  {
    label: '1h',
    hoursBefore: 1,
    untilLabel: '1 hora',
    sentAtCol: registrations.reminder1hSentAt,
    setSent: (now) => ({ reminder1hSentAt: now }),
  },
];

/**
 * The active window is the *narrowest* one currently open — i.e. as we
 * approach the event we want operators to send the 1h reminder, not the
 * 48h one. Returns null outside any window.
 */
export function getActiveWindow(
  hoursUntilEvent: number,
): WindowDef | null {
  if (hoursUntilEvent < 0) return null;
  // Iterate narrowest → widest (1h → 24h → 48h).
  for (const w of [...WINDOWS].reverse()) {
    if (hoursUntilEvent <= w.hoursBefore) return w;
  }
  return null;
}

export function windowByLabel(label: string): WindowDef | null {
  return WINDOWS.find((w) => w.label === label) ?? null;
}

/**
 * Free-form reminder body matching the approved template content.
 * Template body (approved by Meta):
 *   "Olá {{1}}! Faltam {{2}} para o Jesus Vive Brasil — sábado, 16 de maio,
 *    às 19h (horário de Brasília). Assista pelo link: https://jesusvive.church/ao-vivo"
 */
export function buildReminderText(
  firstName: string,
  untilLabel: string,
): string {
  return (
    `Olá ${firstName}! Faltam ${untilLabel} para o Jesus Vive Brasil — ` +
    `sábado, 16 de maio, às 19h (horário de Brasília). ` +
    `Assista pelo link: https://jesusvive.church/ao-vivo`
  );
}

/** Build the wa.me deep-link with the message pre-filled. */
export function buildWaMeLink(whatsapp: string, text: string): string {
  const number = whatsapp.replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
