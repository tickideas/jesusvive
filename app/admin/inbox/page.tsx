/**
 * Admin inbox — WhatsApp conversations.
 *
 * Left: list of conversations (one row per counterparty), with last message
 * preview, timestamp, unread count, and (if matched) the contact's name from
 * the registrations table.
 *
 * Right (when ?w=<E.164> is set): full thread for that conversation, plus a
 * reply box that respects Meta's 24h customer service window.
 */

import Link from 'next/link';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { whatsappMessages, registrations } from '@/lib/schema';
import { ReplyForm } from './ReplyForm';
import { MarkReadOnMount } from './MarkReadOnMount';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ w?: string }>;

function fmt(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { w } = await searchParams;
  const selected = w?.trim() || null;

  // Conversations list: latest message per counterparty + unread count + name.
  // Use a CTE-style subquery for last message; cheap at this scale.
  const conversationsRaw = await db.execute(sql`
    with latest as (
      select distinct on (whatsapp)
        whatsapp,
        body,
        direction,
        created_at,
        read_at
      from whatsapp_messages
      order by whatsapp, created_at desc
    ),
    unread as (
      select whatsapp, count(*)::int as cnt
      from whatsapp_messages
      where direction = 'in' and read_at is null
      group by whatsapp
    ),
    last_inbound as (
      select distinct on (whatsapp)
        whatsapp,
        created_at as last_in_at
      from whatsapp_messages
      where direction = 'in'
      order by whatsapp, created_at desc
    )
    select
      l.whatsapp,
      l.body,
      l.direction,
      l.created_at,
      coalesce(u.cnt, 0)::int as unread,
      li.last_in_at,
      r.first_name,
      r.last_name,
      r.cell_id
    from latest l
    left join unread u on u.whatsapp = l.whatsapp
    left join last_inbound li on li.whatsapp = l.whatsapp
    left join lateral (
      select first_name, last_name, cell_id
      from registrations
      where whatsapp = l.whatsapp
      order by created_at desc
      limit 1
    ) r on true
    order by l.created_at desc
    limit 200
  `);
  const conversations = conversationsRaw as unknown as Array<{
    whatsapp: string;
    body: string | null;
    direction: 'in' | 'out';
    created_at: Date;
    unread: number;
    last_in_at: Date | null;
    first_name: string | null;
    last_name: string | null;
    cell_id: string | null;
  }>;

  // Thread for selected conversation.
  let thread: Array<{
    id: string;
    direction: string;
    body: string | null;
    createdAt: Date;
  }> = [];
  let contact: {
    firstName: string | null;
    lastName: string | null;
    cellId: string | null;
  } | null = null;
  let windowOpen = false;
  let hoursAgo = 9999;

  if (selected) {
    thread = await db
      .select({
        id: whatsappMessages.id,
        direction: whatsappMessages.direction,
        body: whatsappMessages.body,
        createdAt: whatsappMessages.createdAt,
      })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsapp, selected))
      .orderBy(whatsappMessages.createdAt);

    const [reg] = await db
      .select({
        firstName: registrations.firstName,
        lastName: registrations.lastName,
        cellId: registrations.cellId,
      })
      .from(registrations)
      .where(eq(registrations.whatsapp, selected))
      .orderBy(desc(registrations.createdAt))
      .limit(1);
    contact = reg ?? null;

    const [lastIn] = await db
      .select({ createdAt: whatsappMessages.createdAt })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.whatsapp, selected),
          eq(whatsappMessages.direction, 'in'),
        ),
      )
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(1);
    if (lastIn) {
      const ms = Date.now() - lastIn.createdAt.getTime();
      hoursAgo = Math.round(ms / 3600_000);
      windowOpen = ms < 24 * 60 * 60 * 1000;
    }
  }

  const totalUnread = conversations.reduce((a, c) => a + c.unread, 0);

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Inbox{' '}
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-sm text-white">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-600">
            Mensagens recebidas via WhatsApp Business
          </p>
        </div>
        <Link href="/admin" className="text-sm underline text-blue-600">
          ← Voltar
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-[340px,1fr]">
        {/* Conversations */}
        <aside className="border rounded-lg bg-white overflow-hidden">
          {conversations.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              Nenhuma mensagem ainda.
            </div>
          )}
          <ul className="divide-y">
            {conversations.map((c) => {
              const isSelected = c.whatsapp === selected;
              const name =
                c.first_name || c.last_name
                  ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
                  : c.whatsapp;
              return (
                <li key={c.whatsapp}>
                  <Link
                    href={`/admin/inbox?w=${encodeURIComponent(c.whatsapp)}`}
                    className={`block p-3 hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">{name}</div>
                      {c.unread > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {c.direction === 'out' ? '↳ ' : ''}
                      {c.body || '(sem corpo)'}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {fmt(c.created_at)} · {c.whatsapp}
                      {c.cell_id ? ` · ${c.cell_id}` : ''}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Thread */}
        <section className="border rounded-lg bg-white min-h-[400px] flex flex-col">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-sm text-gray-500">
              Selecione uma conversa à esquerda.
            </div>
          ) : (
            <>
              <MarkReadOnMount whatsapp={selected} />
              <header className="border-b p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {contact
                      ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
                      : selected}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selected}
                    {contact?.cellId ? ` · ${contact.cellId}` : ''}
                  </div>
                </div>
                <a
                  href={`https://wa.me/${selected.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline text-blue-600"
                >
                  Abrir no WhatsApp
                </a>
              </header>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg p-2 text-sm shadow-sm ${
                      m.direction === 'in'
                        ? 'bg-white'
                        : 'bg-emerald-100 ml-auto'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.body || <em className="text-gray-400">(vazio)</em>}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 text-right">
                      {fmt(m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t p-3">
                <ReplyForm
                  whatsapp={selected}
                  windowOpen={windowOpen}
                  hoursAgo={hoursAgo}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
