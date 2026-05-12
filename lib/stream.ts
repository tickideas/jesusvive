/**
 * Stream config loader.
 *
 * One row per cell in `stream_configs`. The watch page reads this on every
 * request (with React's request-level cache) so admins can edit live without
 * a redeploy.
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { streamConfigs, type StreamConfig } from './schema';

export type StreamSource = 'offline' | 'hls' | 'youtube';

/** Default offline config used when no row exists yet. */
function defaultConfig(cellId: string): StreamConfig {
  return {
    cellId,
    source: 'offline',
    url: null,
    title: null,
    note: null,
    updatedAt: new Date(0),
    updatedBy: null,
  };
}

/**
 * Fetch the current stream config for a given cell. Never throws — returns an
 * offline default if the row is missing or DB call fails.
 */
export async function getStreamConfig(cellId: string): Promise<StreamConfig> {
  try {
    const [row] = await db
      .select()
      .from(streamConfigs)
      .where(eq(streamConfigs.cellId, cellId))
      .limit(1);
    return row ?? defaultConfig(cellId);
  } catch (err) {
    console.error('[stream] getStreamConfig failed', { cellId, err });
    return defaultConfig(cellId);
  }
}

/** Fetch all configs (for the admin page). */
export async function getAllStreamConfigs(): Promise<StreamConfig[]> {
  return db.select().from(streamConfigs);
}
