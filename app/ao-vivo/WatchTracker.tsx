'use client';

/**
 * Anonymous page-presence beacon for the watch page.
 *
 * Lifecycle per tab:
 *   - on mount: POST { event: 'start' } with referrer + UTMs
 *   - every 30s while document is visible: POST { event: 'ping' }
 *   - on pagehide / beforeunload: sendBeacon { event: 'end' }
 *
 * All requests are fire-and-forget. Any error is swallowed — this component
 * MUST NEVER throw, slow render, or affect the player.
 *
 * Renders nothing.
 */

import { useEffect } from 'react';

interface Props {
  cellId: string;
}

const HEARTBEAT_MS = 30_000;
const ENDPOINT = '/api/analytics/watch';

function makeSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    // fall through
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function readUtms(): Record<string, string | null> {
  try {
    const p = new URL(window.location.href).searchParams;
    return {
      utmSource: p.get('utm_source'),
      utmMedium: p.get('utm_medium'),
      utmCampaign: p.get('utm_campaign'),
      utmContent: p.get('utm_content'),
    };
  } catch {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
    };
  }
}

function isMobileGuess(): boolean {
  try {
    const ua = navigator.userAgent;
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true;
    // iPadOS 13+ identifies as Macintosh by default. Detect via touch points.
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
  } catch {
    return false;
  }
}

export function WatchTracker({ cellId }: Props) {
  useEffect(() => {
    const sessionId = makeSessionId();
    const utms = readUtms();
    const basePayload = {
      sessionId,
      cellId,
      referrer: document.referrer || null,
      ...utms,
      isMobile: isMobileGuess(),
    };

    const send = (event: 'start' | 'ping' | 'end'): void => {
      const body = JSON.stringify({ ...basePayload, event });
      try {
        // Prefer sendBeacon on unload — fetch can be cancelled by navigation.
        if (event === 'end' && navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(ENDPOINT, blob);
          return;
        }
        // keepalive lets the browser finish the request after navigation.
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {
          // ignore — analytics never affects UX
        });
      } catch {
        // ignore
      }
    };

    send('start');

    let timer: number | undefined;
    const stopHeartbeat = (): void => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const startHeartbeat = (): void => {
      stopHeartbeat();
      timer = window.setInterval(() => send('ping'), HEARTBEAT_MS);
    };

    if (document.visibilityState === 'visible') startHeartbeat();

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        // A returning tab gets a fresh ping immediately to mark "still here".
        send('ping');
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    const onPageHide = (): void => {
      stopHeartbeat();
      send('end');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    // beforeunload is unreliable on mobile but doesn't hurt as a backup.
    window.addEventListener('beforeunload', onPageHide);

    return () => {
      stopHeartbeat();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      // Best-effort end on unmount (e.g. SPA nav). Safe even if pagehide
      // already fired — the endpoint just stamps ended_at again.
      send('end');
    };
  }, [cellId]);

  return null;
}
