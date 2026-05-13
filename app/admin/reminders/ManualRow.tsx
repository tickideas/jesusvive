'use client';

/**
 * One row in the manual reminder worklist.
 *
 * Workflow:
 *   1. Operator clicks "Abrir WhatsApp" — opens wa.me in a new tab/app
 *      with the reminder text pre-filled.
 *   2. Operator hits send in WhatsApp (manually).
 *   3. Operator returns to this page and clicks "Marcar como enviado" —
 *      we stamp reminder_<window>_sent_at so the auto-cron skips this row
 *      when Twilio comes back.
 */

import { useState, useTransition } from 'react';

interface Props {
  id: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  cityLabel: string;
  waLink: string;
  window: '48h' | '24h' | '1h';
}

export function ManualRow({
  id,
  firstName,
  lastName,
  whatsapp,
  cityLabel,
  waLink,
  window: w,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [opened, setOpened] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markSent() {
    setError(null);
    const res = await fetch('/api/admin/manual-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, window: w }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || 'Falha ao marcar.');
      return;
    }
    setDone(true);
    // Drop the row from the visible list after a short beat so the
    // operator can confirm visually.
    setTimeout(() => {
      window.location.reload();
    }, 600);
  }

  return (
    <tr className={`border-t ${done ? 'opacity-40' : ''}`}>
      <td className="px-3 py-2">
        {firstName} {lastName}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{whatsapp}</td>
      <td className="px-3 py-2">{cityLabel}</td>
      <td className="px-3 py-2">
        <div className="flex gap-2 items-center">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpened(true)}
            className="inline-flex items-center rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            {opened ? 'Reabrir WhatsApp' : 'Abrir WhatsApp'}
          </a>
          <button
            type="button"
            disabled={!opened || pending || done}
            onClick={() => startTransition(markSent)}
            className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {done ? '✓ Enviado' : pending ? 'Salvando…' : 'Marcar enviado'}
          </button>
          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>
      </td>
    </tr>
  );
}
