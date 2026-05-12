'use client';

/**
 * HLS player. Uses native HLS where supported (Safari/iOS), falls back to
 * hls.js everywhere else. Designed to be drop-in alongside the YouTube
 * iframe path on the watch page.
 */

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface Props {
  src: string;
  poster?: string;
}

export function HLSPlayer({ src, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);

    // Safari / iOS: native HLS support.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    if (!Hls.isSupported()) {
      setError('Seu navegador não suporta esta transmissão. Tente outro.');
      return;
    }

    const hls = new Hls({
      lowLatencyMode: true,
      enableWorker: true,
    });
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.ERROR, (_event, data) => {
      // Try to recover from network/media errors; only show UI on fatal.
      if (!data.fatal) return;
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          setError('Erro ao carregar a transmissão. Atualize a página.');
          hls.destroy();
      }
    });

    return () => {
      hls.destroy();
    };
  }, [src]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted /* Required for autoplay on most browsers; user can unmute. */
        poster={poster}
        className="h-full w-full bg-black"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center text-sm text-white p-4">
          {error}
        </div>
      )}
    </div>
  );
}
