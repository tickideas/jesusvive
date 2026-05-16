'use client';

/**
 * Re-runs the server component every N seconds via router.refresh(), which
 * preserves scroll position and any unrelated client state \u2014 unlike a
 * <meta http-equiv="refresh"> full page reload.
 *
 * Pauses while the tab is hidden to avoid wasting DB cycles on inactive
 * dashboards.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  intervalMs: number;
}

export function AutoRefresh({ intervalMs }: Props) {
  const router = useRouter();

  useEffect(() => {
    let timer: number | undefined;

    const start = (): void => {
      stop();
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') router.refresh();
      }, intervalMs);
    };
    const stop = (): void => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    start();
    const onVis = (): void => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs, router]);

  return null;
}
