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

export const metadata: Metadata = {
  title: 'Ao Vivo — Jesus Vive Brasil',
  description: 'Escolha sua cidade para acompanhar Jesus Vive Brasil ao vivo.',
};

export const dynamic = 'force-static';

export default function StreamingPicker() {
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
          {Object.values(CELL_CONFIG).map((cell) => (
            <li key={cell.slug}>
              <Link
                href={`/ao-vivo/${cell.slug}`}
                className="block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-accent hover:bg-white/10"
              >
                <div className="font-display text-xl font-bold">
                  {cell.cityLabel}
                </div>
                <div className="mt-1 text-xs text-white/60">{cell.state}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
