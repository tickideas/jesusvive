'use client';

/**
 * Unified Plyr-based player for both HLS and YouTube sources.
 *
 * Plyr touches `document` at module-eval time, which is fine in the browser
 * but throws under Next's server bundle. We dynamic-import Plyr inside the
 * effect so it never runs during SSR/prerender.
 *
 * Autoplay strategy: every modern browser requires muted autoplay. We start
 * muted and show a small "tap to unmute" hint for the first few seconds.
 */

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

type Source = 'hls' | 'youtube';

interface Props {
  source: Source;
  /** For HLS: .m3u8 URL. For YouTube: the video ID. */
  url: string;
}

interface PlyrLike {
  play(): Promise<void> | void;
  destroy(): void;
  on(event: string, handler: () => void): void;
  muted: boolean;
}

export function StreamPlayer({ source, url }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let plyr: PlyrLike | null = null;
    let hls: Hls | null = null;
    let element: HTMLElement | null = null;

    // Build the player element synchronously so the user sees the box,
    // then load Plyr's runtime asynchronously and enhance it.
    if (source === 'youtube') {
      const div = document.createElement('div');
      div.className = 'plyr__video-embed';
      div.dataset.plyrProvider = 'youtube';
      div.dataset.plyrEmbedId = url;
      container.appendChild(div);
      element = div;
    } else {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('controls', '');
      video.muted = true;
      video.autoplay = true;
      video.className = 'h-full w-full';
      container.appendChild(video);
      element = video;

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      } else if (Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true, enableWorker: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls?.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          } else {
            setError('Erro ao carregar a transmissão. Atualize a página.');
            hls?.destroy();
          }
        });
      } else {
        setError('Seu navegador não suporta esta transmissão. Tente outro.');
      }
    }

    // Load Plyr at runtime so SSR never touches `document`.
    Promise.all([import('plyr'), import('plyr/dist/plyr.css')])
      .then(([mod]) => {
        if (cancelled || !element) return;
        const PlyrCtor = (
          mod as unknown as {
            default?: new (
              target: HTMLElement,
              options?: object,
            ) => PlyrLike;
          }
        ).default;
        if (!PlyrCtor) return;
        plyr = new PlyrCtor(element, {
          autoplay: true,
          muted: true,
          controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'mute',
            'volume',
            'fullscreen',
          ],
          youtube: { noCookie: true, rel: 0, modestbranding: 1 },
        });
        plyr.on('ready', () => {
          plyr?.play()?.catch?.(() => {
            // Browser refused autoplay even when muted; user can tap.
          });
        });
        plyr.on('volumechange', () => {
          if (plyr && !plyr.muted) setShowUnmuteHint(false);
        });
        plyr.on('pause', () => setShowUnmuteHint(false));
      })
      .catch(() => {
        // Plyr failed to load; the raw <video> still works for HLS.
      });

    const timer = window.setTimeout(() => setShowUnmuteHint(false), 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      try {
        plyr?.destroy();
      } catch {
        // ignore
      }
      hls?.destroy();
      if (element && element.parentNode === container) {
        container.removeChild(element);
      }
    };
  }, [source, url]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {showUnmuteHint && !error && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white shadow">
          🔇 Toque para ativar o som
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center text-sm text-white p-4">
          {error}
        </div>
      )}
    </div>
  );
}
