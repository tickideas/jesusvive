'use client';

import { useSearchParams } from 'next/navigation';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export function ThankYouContent() {
  const searchParams = useSearchParams();
  const cellId = searchParams.get('cell') || 'cell-1';

  const waMessage =
    'Olá! Acabei de me inscrever em Jesus Vive Brasil e quero confirmar minha participação.';
  const waLink = buildWhatsAppLink(waMessage);

  const eventDate = '2026-05-16T19:00:00-03:00';
  const eventTitle = 'Jesus Vive Brasil';
  const eventDetails = 'Encontro online — link enviado pelo WhatsApp';

  const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    eventTitle,
  )}&dates=20260516T220000Z/20260517T000000Z&details=${encodeURIComponent(eventDetails)}`;

  const shareText = encodeURIComponent(
    'Eu acabei de me inscrever em Jesus Vive Brasil! Inscreva-se você também: https://jesusvive.church',
  );
  const shareWaUrl = `https://wa.me/?text=${shareText}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-brand-primary/15 flex items-center justify-center text-3xl text-brand-primary">
        ✓
      </div>
      <h1 className="mt-6 font-display text-3xl font-extrabold sm:text-4xl">
        Inscrição confirmada!
      </h1>
      <p className="mt-3 text-lg text-brand-dark/80">
        Estamos felizes em te receber. Em breve você receberá uma mensagem
        no WhatsApp com todos os detalhes do encontro de <strong>16 de maio</strong>.
      </p>

      <div className="mt-8 space-y-3">
        <a href={waLink} target="_blank" rel="noopener" className="btn-primary w-full sm:w-auto">
          Confirmar no WhatsApp agora
        </a>
        <div className="block">
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener"
            className="btn-secondary w-full sm:w-auto"
          >
            Adicionar ao Google Calendar
          </a>
        </div>
      </div>

      <div className="mt-12 rounded-2xl bg-white p-6 shadow-md">
        <h2 className="font-display text-xl font-bold">Convide alguém especial</h2>
        <p className="mt-2 text-sm text-brand-dark/75">
          A vida muda quando Jesus toca o coração. Compartilhe este convite com quem
          você ama.
        </p>
        <a
          href={shareWaUrl}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-block text-sm font-semibold text-brand-primary underline"
        >
          Compartilhar no WhatsApp →
        </a>
      </div>

      <p className="mt-10 text-xs text-brand-dark/50">
        Célula: {cellId} • Evento em {new Date(eventDate).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
      </p>
    </div>
  );
}
