'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  name: string;
}

export function DeleteRowButton({ id, name }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (
      !window.confirm(
        `Apagar registro de "${name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Erro: ${body.error || res.statusText}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || pending}
      title="Apagar registro"
      className="text-red-600 hover:text-red-800 disabled:opacity-40"
    >
      {busy || pending ? '…' : '✕'}
    </button>
  );
}
