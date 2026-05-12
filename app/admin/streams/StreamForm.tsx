'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  cellId: string;
  cityLabel: string;
  watchUrl: string;
  initial: {
    source: string;
    url: string;
    title: string;
    note: string;
    updatedAt: Date;
    updatedBy: string | null;
  };
}

export function StreamForm({ cellId, cityLabel, watchUrl, initial }: Props) {
  const router = useRouter();
  const [source, setSource] = useState(initial.source);
  const [url, setUrl] = useState(initial.url);
  const [title, setTitle] = useState(initial.title);
  const [note, setNote] = useState(initial.note);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = async () => {
    setStatus(null);
    const res = await fetch('/api/admin/streams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellId, source, url, title, note }),
    });
    if (res.ok) {
      setStatus('Salvo ✓');
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Erro: ${body.error || res.statusText}`);
    }
  };

  const urlPlaceholder =
    source === 'hls'
      ? 'https://stream.example.com/live/cell1.m3u8'
      : source === 'youtube'
        ? 'Video ID (ex: dQw4w9WgXcQ)'
        : '—';

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-lg">{cityLabel}</h3>
          <div className="text-xs text-gray-500">{cellId}</div>
        </div>
        <div className="flex gap-2">
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline text-blue-600"
          >
            Abrir watch page
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block text-gray-700 mb-1">Fonte</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full border rounded px-2 py-1.5"
          >
            <option value="offline">Offline (em breve)</option>
            <option value="hls">HLS (.m3u8)</option>
            <option value="youtube">YouTube</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="block text-gray-700 mb-1">URL / Video ID</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={urlPlaceholder}
            disabled={source === 'offline'}
            className="w-full border rounded px-2 py-1.5 disabled:bg-gray-100"
          />
        </label>

        <label className="block text-sm">
          <span className="block text-gray-700 mb-1">Título (opcional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Sessão 1 — Adoração"
            className="w-full border rounded px-2 py-1.5"
          />
        </label>

        <label className="block text-sm">
          <span className="block text-gray-700 mb-1">Nota (opcional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mostrada abaixo do player"
            className="w-full border rounded px-2 py-1.5"
          />
        </label>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <div className="text-xs text-gray-500">
          Última alteração:{' '}
          {initial.updatedAt.getTime() === 0
            ? 'nunca'
            : `${initial.updatedAt.toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}${initial.updatedBy ? ' por ' + initial.updatedBy : ''}`}
        </div>
        <div className="flex items-center gap-3">
          {status && <span className="text-sm">{status}</span>}
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
