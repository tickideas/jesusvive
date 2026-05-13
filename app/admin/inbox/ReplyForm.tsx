'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  whatsapp: string;
  windowOpen: boolean;
  hoursAgo: number;
}

export function ReplyForm({ whatsapp, windowOpen, hoursAgo }: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = async () => {
    if (!body.trim()) return;
    setStatus(null);
    const res = await fetch('/api/admin/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp, body }),
    });
    if (res.ok) {
      setBody('');
      setStatus('Enviado ✓');
      startTransition(() => router.refresh());
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(`Erro: ${j.error || res.statusText}`);
    }
  };

  if (!windowOpen) {
    return (
      <div className="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        <strong>Janela de 24h fechada.</strong>{' '}
        Última mensagem do contato há {hoursAgo}h. Para responder agora você
        precisa enviar um <em>template aprovado</em> (ex:{' '}
        <code>jesusvive_lembrete</code>) — a resposta livre só funciona dentro
        de 24h desde a última mensagem do contato.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Resposta..."
        rows={3}
        maxLength={1500}
        className="w-full border rounded p-2 text-sm"
      />
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{body.length}/1500</span>
        <div className="flex items-center gap-2">
          {status && <span>{status}</span>}
          <button
            type="button"
            onClick={send}
            disabled={pending || !body.trim()}
            className="rounded bg-emerald-600 px-3 py-1 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
