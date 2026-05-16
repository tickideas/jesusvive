import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CELL_CONFIG, type CellSlug } from '@/lib/cells';
import { HeroSection } from '@/components/HeroSection';
import { RegistrationForm } from '@/components/RegistrationForm';
import { getStreamConfig } from '@/lib/stream';

// Dynamic because the live banner reads stream_configs on each request.
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return Object.keys(CELL_CONFIG).map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const cell = CELL_CONFIG[city as CellSlug];
  if (!cell) return {};
  return {
    title: `Jesus Vive Brasil — ${cell.cityLabel}`,
    description: `Inscreva-se gratuitamente para o encontro online de 16 de maio em ${cell.cityLabel}.`,
    openGraph: {
      title: `Jesus Vive Brasil — ${cell.cityLabel}`,
      description: `Encontro online gratuito • 16 de maio de 2026`,
      type: 'website',
      locale: 'pt_BR',
    },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const cell = CELL_CONFIG[city as CellSlug];
  if (!cell) notFound();

  // Map URL slug to dropdown default value
  const cityDefaultMap: Record<CellSlug, string> = {
    saopaulo: 'sao-paulo',
    rio: 'rio-de-janeiro',
    brasilia: 'brasilia',
  };

  // Show the live banner only when admin has flipped this cell's stream
  // to an active source. Avoids lying to visitors before 19:00 BRT.
  const stream = await getStreamConfig(cell.cellId);
  const isLive = stream.source === 'hls' || stream.source === 'youtube';

  return (
    <main>
      {isLive && (
        <a
          href={`/ao-vivo/${cell.slug}`}
          className="block bg-red-600 text-white py-3 px-4 text-center font-semibold hover:bg-red-700"
        >
          🔴 AO VIVO AGORA — {cell.cityLabel} · Clique para assistir
        </a>
      )}

      <HeroSection cell={cell} />

      <section id="inscricao" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              O que você vai viver
            </h2>
            <p className="mt-4 text-lg text-brand-dark/80">
              Um encontro online onde a Palavra de Deus se torna real. Adoração,
              pregação ungida e oração pela sua vida — tudo gratuito, ao vivo,
              direto na sua casa.
            </p>
            <div className="mt-8 space-y-4">
              <Feature
                title="Ao vivo no dia 16 de maio"
                body="Reserve sua data. Você receberá o link de acesso pelo WhatsApp."
              />
              <Feature
                title="Acompanhamento pessoal"
                body="Após o evento, conecte-se com uma célula em sua região para apoio espiritual."
              />
              <Feature
                title="Para toda a família"
                body="Convide quem você ama. A inscrição é individual e gratuita."
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <h3 className="font-display text-2xl font-bold">Garanta sua vaga</h3>
            <p className="mt-1 mb-6 text-sm text-brand-dark/70">
              Inscrição gratuita • Leva menos de 1 minuto
            </p>
            <RegistrationForm
              cellId={cell.cellId}
              defaultCity={cityDefaultMap[cell.slug]}
            />
          </div>
        </div>
      </section>

      <Footer cellLabel={cell.cityLabel} />
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-6 w-6 flex-shrink-0 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
        ✓
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-brand-dark/75">{body}</p>
      </div>
    </div>
  );
}

function Footer({ cellLabel }: { cellLabel: string }) {
  return (
    <footer className="border-t border-brand-dark/10 bg-white py-8 text-center text-sm text-brand-dark/60">
      <p>© {new Date().getFullYear()} Jesus Vive Brasil — {cellLabel}</p>
      <p className="mt-2">
        <a href="/privacidade" className="underline hover:text-brand-primary">
          Política de Privacidade (LGPD)
        </a>
      </p>
    </footer>
  );
}
