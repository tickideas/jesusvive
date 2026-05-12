/**
 * Admin: per-cell stream configuration. Auth via middleware.ts.
 *
 * Lets event-day operators swap stream sources (HLS / YouTube / offline)
 * live without a redeploy. Each cell is independent.
 */

import Link from 'next/link';
import { CELL_CONFIG } from '@/lib/cells';
import { getStreamConfig } from '@/lib/stream';
import { StreamForm } from './StreamForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminStreamsPage() {
  const cells = Object.values(CELL_CONFIG);
  const configs = await Promise.all(
    cells.map((c) => getStreamConfig(c.cellId)),
  );

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Streams — Admin</h1>
          <p className="text-sm text-gray-600">
            Gerencie a transmissão de cada célula. Mudanças entram no ar
            imediatamente (sem redeploy).
          </p>
        </div>
        <Link href="/admin" className="text-sm underline text-blue-600">
          ← Voltar ao dashboard
        </Link>
      </header>

      <section className="rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
        <strong>Dica:</strong> teste o stream HLS em outra aba antes do evento.
        Use “Offline” entre sessões para mostrar a tela de “em breve”.
      </section>

      <div className="space-y-4">
        {cells.map((cell, i) => {
          const cfg = configs[i];
          return (
            <StreamForm
              key={cell.cellId}
              cellId={cell.cellId}
              cityLabel={cell.cityLabel}
              watchUrl={`/ao-vivo/${cell.slug}`}
              initial={{
                source: cfg.source,
                url: cfg.url || '',
                title: cfg.title || '',
                note: cfg.note || '',
                updatedAt: cfg.updatedAt,
                updatedBy: cfg.updatedBy,
              }}
            />
          );
        })}
      </div>
    </main>
  );
}
