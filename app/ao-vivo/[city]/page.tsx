/**
 * Per-cell watch page. e.g. /ao-vivo/saopaulo
 *
 * Reads stream config from DB on each request (no cache) so admins can swap
 * URLs live during the event. Each cell has its own page, its own stream,
 * and walk-in registrations are auto-tagged to that cell.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CELL_CONFIG, type CellSlug } from '@/lib/cells';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getStreamConfig } from '@/lib/stream';
import { WalkInModal } from '../WalkInModal';
import { StreamPlayer } from '../StreamPlayer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CITIES: CellSlug[] = ['saopaulo', 'rio', 'brasilia'];

export function generateStaticParams() {
  return CITIES.map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const cell = CELL_CONFIG[city as CellSlug];
  if (!cell) return { title: 'Ao Vivo — Jesus Vive Brasil' };
  return {
    title: `Ao Vivo ${cell.cityLabel} — Jesus Vive Brasil`,
    description: `Acompanhe Jesus Vive Brasil ao vivo com a célula de ${cell.cityLabel}.`,
  };
}

export default async function CellStreamPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const cell = CELL_CONFIG[city as CellSlug];
  if (!cell) notFound();

  const stream = await getStreamConfig(cell.cellId);
  const waLink = buildWhatsAppLink(
    `Estou assistindo Jesus Vive Brasil (${cell.cityLabel}) ao vivo e quero acompanhamento.`,
  );

  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <header className="border-b border-white/10 bg-brand-dark/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-accent">
              Ao Vivo · {cell.cityLabel}{' '}
              <Link
                href="/ao-vivo?pick=1"
                className="ml-1 normal-case tracking-normal text-white/60 underline"
              >
                trocar
              </Link>
            </p>
            <p className="font-display font-bold">Jesus Vive Brasil</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                stream.source === 'offline'
                  ? 'bg-gray-500'
                  : 'animate-pulse bg-red-500'
              }`}
            />
            <span className="font-semibold">
              {stream.source === 'offline' ? 'EM BREVE' : 'LIVE'}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div>
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
              {stream.source === 'hls' && stream.url ? (
                <StreamPlayer source="hls" url={stream.url} />
              ) : stream.source === 'youtube' && stream.url ? (
                <StreamPlayer source="youtube" url={stream.url} />
              ) : (
                <div className="flex h-full items-center justify-center text-white/60">
                  <p>A transmissão começará em breve.</p>
                </div>
              )}
            </div>

          {stream.title && (
            <h2 className="mt-4 font-display text-lg font-bold">
              {stream.title}
            </h2>
          )}
          {stream.note && (
            <p className="mt-1 text-sm text-white/70">{stream.note}</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <WalkInModal
              label="Quero conhecer Jesus"
              cellId={cell.cellId}
              cityLabel={cell.cityLabel}
            />
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              className="btn-secondary border-white bg-transparent text-white hover:bg-white hover:text-brand-dark"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
