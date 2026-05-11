import type { Metadata } from 'next';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { WalkInModal } from './WalkInModal';

export const metadata: Metadata = {
  title: 'Ao Vivo — Jesus Vive Brasil',
  description: 'Acompanhe o encontro Jesus Vive Brasil ao vivo.',
};

export const dynamic = 'force-static';

export default function StreamingPortal() {
  const youtubeId = process.env.NEXT_PUBLIC_YOUTUBE_LIVE_ID || '';
  const waLink = buildWhatsAppLink('Estou assistindo Jesus Vive Brasil ao vivo e quero acompanhamento.');

  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <header className="border-b border-white/10 bg-brand-dark/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-accent">
              Ao Vivo
            </p>
            <p className="font-display font-bold">Jesus Vive Brasil</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="font-semibold">LIVE</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
          {/* Player */}
          <div>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
              {youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                  title="Jesus Vive Brasil — Ao Vivo"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/60">
                  <p>A transmissão começará em breve.</p>
                </div>
              )}
            </div>

            {/* Persistent CTA bar */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <WalkInModal label="Quero conhecer Jesus" />
              <a
                href={waLink}
                target="_blank"
                rel="noopener"
                className="btn-secondary border-white bg-transparent text-white hover:bg-white hover:text-brand-dark"
              >
                Falar no WhatsApp
              </a>
            </div>

            <div className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-white/85">
              <h3 className="font-display text-base font-bold text-brand-accent">
                Agenda
              </h3>
              <ul className="mt-2 space-y-1">
                <li>• Adoração e oração</li>
                <li>• Mensagem da Palavra</li>
                <li>• Tempo de ministração</li>
                <li>• Próximos passos com sua célula</li>
              </ul>
            </div>
          </div>

          {/* Sidebar: prayer wall + info */}
          <aside className="space-y-4">
            <div className="rounded-xl bg-white/5 p-4">
              <h3 className="font-display text-base font-bold text-brand-accent">
                Mural de Oração
              </h3>
              <p className="mt-2 text-xs text-white/70">
                Deixe seu pedido — vamos orar por você.
              </p>
              {/* TODO: Integrate Tawk.to / Socket.io / Disqus for live prayer wall */}
              <div className="mt-3 rounded-lg border border-dashed border-white/20 p-6 text-center text-xs text-white/50">
                Mural em breve
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-4 text-sm">
              <h3 className="font-display text-base font-bold text-brand-accent">
                Idioma
              </h3>
              <div className="mt-2 flex gap-2">
                <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  PT-BR
                </button>
                <button className="rounded-md px-3 py-1.5 text-xs text-white/60">
                  EN
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
