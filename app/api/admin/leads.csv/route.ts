/**
 * CSV export of registrations. Auth via middleware.ts (basic auth).
 *
 * Honors the same filters as /admin: cell, source, from, to, q.
 * Streams the whole filtered result (no PAGE_SIZE cap — this is meant for
 * downloads). Excel/Google Sheets compatible: UTF-8 BOM + CRLF.
 */

import { NextRequest } from 'next/server';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Quote if it contains comma, quote, or newline; escape inner quotes.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  'id',
  'created_at',
  'first_name',
  'last_name',
  'whatsapp',
  'email',
  'city',
  'cell_id',
  'language',
  'source',
  'lgpd_consent',
  'lgpd_consent_at',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'confirmation_sent_at',
  'reminder_48h_sent_at',
  'reminder_24h_sent_at',
  'reminder_1h_sent_at',
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cellFilter = url.searchParams.get('cell')?.trim() || '';
  const sourceFilter = url.searchParams.get('source')?.trim() || '';
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const q = url.searchParams.get('q')?.trim() || '';

  const conditions: SQL[] = [];
  if (cellFilter) conditions.push(eq(registrations.cellId, cellFilter));
  if (sourceFilter) conditions.push(eq(registrations.source, sourceFilter));
  if (from) conditions.push(gte(registrations.createdAt, from));
  if (to) conditions.push(lte(registrations.createdAt, to));
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${registrations.firstName}) like ${like}
        or lower(${registrations.lastName}) like ${like}
        or lower(coalesce(${registrations.email}, '')) like ${like}
        or ${registrations.whatsapp} like ${like})`,
    );
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(registrations)
    .where(whereClause)
    .orderBy(desc(registrations.createdAt));

  // UTF-8 BOM so Excel detects encoding correctly.
  const lines: string[] = ['\ufeff' + HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt,
        r.firstName,
        r.lastName,
        r.whatsapp,
        r.email,
        r.city,
        r.cellId,
        r.language,
        r.source,
        r.lgpdConsent,
        r.lgpdConsentAt,
        r.utmSource,
        r.utmMedium,
        r.utmCampaign,
        r.utmContent,
        r.confirmationSentAt,
        r.reminder48hSentAt,
        r.reminder24hSentAt,
        r.reminder1hSentAt,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  const body = lines.join('\r\n');

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="jesusvive-leads-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
