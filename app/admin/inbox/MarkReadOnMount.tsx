'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Fires a single POST to mark this thread's unread inbound messages as read
 * when the page mounts. Used inside the inbox detail view.
 */
export function MarkReadOnMount({ whatsapp }: { whatsapp: string }) {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/admin/inbox/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp }),
    })
      .then((r) => {
        if (r.ok) router.refresh();
      })
      .catch(() => {});
  }, [whatsapp, router]);
  return null;
}
