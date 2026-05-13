/**
 * Fallback /ao-vivo landing — city picker.
 *
 * E-cards should link directly to /ao-vivo/saopaulo|rio|brasilia. This page
 * is a safety net for anyone who types the bare URL or shares it without
 * the city suffix.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { CELL_CONFIG } from '@/lib/cells';
import { getStreamConfig } from '@/lib/stream';

export const metadata: Metadata = {
  title: 'Ao Vivo — Jesus Vive Brasil',
  description: 'Escolha sua cidade para acompanhar Jesus Vive Brasil ao vivo.',
};

// Reads live stream state per cell on each request so the LIVE / EM BREVE
// badges stay accurate as admins flip sources.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StreamingPicker() {
  const cells = Object.values(CELL_CONFIG);
  const configs = await Promise.all(
    cells.map((c) => getStreamConfig(c.cellId)),
  );

  return (
    <main className="min-h-screen bg-brand-dark text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-widest text-brand-accent">
          Ao Vivo
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          Jesus Vive Brasil
        </h1>
        <p className="mt-3 text-white/75">
          Escolha sua cidade para entrar na transmissão da sua célula.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {cells.map((cell, i) => {
            const cfg = configs[i];
            const isLive = cfg.source !== 'offline' && Boolean(cfg.url);
            return (
              <li key={cell.slug}>
                <Link
                  href={`/ao-vivo/${cell.slug}`}
                  className="group block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-accent hover:bg-white/10 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isLive ? 'animate-pulse bg-red-500' : 'bg-gray-500'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isLive ? 'text-red-400' : 'text-white/50'
                      }`}
                    >
                      {isLive ? 'Ao vivo' : 'Em breve'}
                    </span>
                  </div>
                  <div className="mt-2 font-display text-xl font-bold">
                    {cell.cityLabel}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {cell.state}
                  </div>
                  {cfg.title && (
                    <div className="mt-2 text-xs text-white/70 line-clamp-2">
                      {cfg.title}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
