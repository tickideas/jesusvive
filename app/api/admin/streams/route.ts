/**
 * Admin: update a cell's stream configuration. Auth via middleware.ts.
 *
 * POST body (JSON):
 *   { cellId: "cell-1", source: "hls"|"youtube"|"offline",
 *     url?: string, title?: string, note?: string }
 *
 * Upserts the single row for that cell.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { streamConfigs } from '@/lib/schema';
import { CELL_CONFIG } from '@/lib/cells';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CELL_IDS = Object.values(CELL_CONFIG).map((c) => c.cellId);

const bodySchema = z
  .object({
    cellId: z.enum(VALID_CELL_IDS as [string, ...string[]]),
    source: z.enum(['offline', 'hls', 'youtube']),
    url: z.string().trim().max(2000).optional().or(z.literal('')),
    title: z.string().trim().max(200).optional().or(z.literal('')),
    note: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine(
    (v) => v.source === 'offline' || (v.url && v.url.length > 0),
    { message: 'URL é obrigatória para HLS/YouTube.', path: ['url'] },
  );

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
  const { cellId, source, url, title, note } = parsed.data;

  const updatedBy =
    req.headers.get('x-forwarded-user') ||
    process.env.ADMIN_USERNAME ||
    'admin';

  await db
    .insert(streamConfigs)
    .values({
      cellId,
      source,
      url: url || null,
      title: title || null,
      note: note || null,
      updatedAt: new Date(),
      updatedBy,
    })
    .onConflictDoUpdate({
      target: streamConfigs.cellId,
      set: {
        source,
        url: url || null,
        title: title || null,
        note: note || null,
        updatedAt: new Date(),
        updatedBy,
      },
    });

  return NextResponse.json({ ok: true });
}
