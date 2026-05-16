/**
 * Pure validation helpers for the watch-analytics endpoint. Kept separate
 * from route.ts so they can be unit-tested without standing up a Next
 * request or a database connection.
 */

import { CELL_CONFIG } from '../../../../lib/cells';

export type WatchEvent = 'start' | 'ping' | 'end';

export const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export const VALID_CELL_IDS: ReadonlySet<string> = new Set(
  Object.values(CELL_CONFIG).map((c) => c.cellId),
);

export function isWatchEvent(v: unknown): v is WatchEvent {
  return v === 'start' || v === 'ping' || v === 'end';
}

export function isValidSessionId(v: unknown): v is string {
  return typeof v === 'string' && SESSION_ID_RE.test(v);
}

export function isValidCellId(v: unknown): v is string {
  return typeof v === 'string' && VALID_CELL_IDS.has(v);
}

/**
 * Best-effort string sanitizer: trims, returns null for non-strings or
 * empty values, and truncates to `max` chars to bound DB writes.
 */
export function sanitizeString(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * Origin/Referer check. When `allowed` is empty, accepts everything (dev
 * default). When non-empty, requires either Origin or Referer to match.
 */
export function isOriginAllowed(
  allowed: readonly string[],
  origin: string | null,
  referer: string | null,
): boolean {
  if (allowed.length === 0) return true;
  if (origin) return allowed.includes(origin);
  if (!referer) return false;
  try {
    return allowed.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}
