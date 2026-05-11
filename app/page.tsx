import Link from 'next/link';
import type { Metadata } from 'next';
import { CELL_CONFIG } from '@/lib/cells';

export const metadata: Metadata = {
  title: 'Jesus Vive Brasil — Escolha sua cidade',
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-accent">
          16 de maio de 2026 • Online e gratuito
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-6xl">
          Jesus está vivo — e Ele está no Brasil.
        </h1>
        <p className="mt-5 text-lg text-white/85 sm:text-xl">
          Escolha sua cidade e inscreva-se gratuitamente.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {Object.values(CELL_CONFIG).map((cell) => (
            <Link
              key={cell.slug}
              href={`/${cell.slug}`}
              className="group rounded-xl border-2 border-white/20 bg-white/5 p-6 transition-all hover:border-brand-accent hover:bg-white/10"
            >
              <p className="text-xs uppercase tracking-widest text-brand-accent">
                {cell.state}
              </p>
              <p className="mt-2 font-display text-2xl font-bold">
                {cell.cityLabel}
              </p>
              <p className="mt-1 text-sm text-white/70 group-hover:text-white">
                Inscreva-se →
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-sm text-white/60">
          Você é de outra cidade?{' '}
          <Link href="/saopaulo" className="underline hover:text-brand-accent">
            Inscreva-se aqui
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
