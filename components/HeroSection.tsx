import { buildWhatsAppLink } from '@/lib/whatsapp';
import type { CellConfig } from '@/lib/cells';

interface Props {
  cell: CellConfig;
}

export function HeroSection({ cell }: Props) {
  const eventDate = '16 de maio de 2026';
  const waLink = buildWhatsAppLink(cell.whatsappGreeting);

  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-dark to-brand-primary/40" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-accent">
              {cell.cityLabel} • {eventDate}
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              {cell.heroHeadline}
            </h1>
            <p className="mt-5 text-lg text-white/90 sm:text-xl">
              {cell.heroSubheadline}
            </p>
            <ul className="mt-6 space-y-2 text-white/85">
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">✓</span>
                <span>Encontro 100% online — assista de casa</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">✓</span>
                <span>Em português — para todo o Brasil</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">✓</span>
                <span>Acompanhamento gratuito pelo WhatsApp</span>
              </li>
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#inscricao" className="btn-primary text-lg">
                Inscreva-se
              </a>
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
          <div className="hidden lg:block">
            <div className="aspect-[4/5] w-full rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
