/**
 * Manual reminder worklist — fallback for when Twilio is unavailable.
 *
 * Shows only registrations that still need the *currently-active* reminder
 * (48h / 24h / 1h based on time-until-event). For each row the operator
 * can:
 *   1. Tap "Abrir WhatsApp" → opens wa.me with the reminder pre-filled
 *   2. Hit send in WhatsApp manually
 *   3. Tap "Marcar enviado" → POST /api/admin/manual-reminder stamps the
 *      sent-at column so the auto-cron will skip this row once Twilio
 *      comes back online.
 *
 * The window selector lets the operator force a specific window (e.g. if
 * the cron has been down for hours and they want to clear all three
 * windows manually in sequence).
 */

import Link from 'next/link';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';
import { CELL_CONFIG } from '@/lib/cells';
import {
  WINDOWS,
  getActiveWindow,
  windowByLabel,
  buildReminderText,
  buildWaMeLink,
} from '@/lib/manual-reminder';
import { ManualRow } from './ManualRow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ window?: string; cell?: string }>;

const EVENT_DATE =
  process.env.NEXT_PUBLIC_EVENT_DATE || '2026-05-16T19:00:00-03:00';

function cellLabel(cellId: string): string {
  for (const c of Object.values(CELL_CONFIG)) {
    if (c.cellId === cellId) return c.cityLabel;
  }
  return cellId;
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const eventAt = new Date(EVENT_DATE);
  const hoursUntilEvent =
    (eventAt.getTime() - Date.now()) / (60 * 60 * 1000);

  const forced = sp.window ? windowByLabel(sp.window) : null;
  const active = forced ?? getActiveWindow(hoursUntilEvent);
  const cellFilter = sp.cell?.trim() || '';

  // Pending count for each window — gives the operator a quick overview.
  const pendingCounts: Record<string, number> = {};
  for (const w of WINDOWS) {
    const conds = [isNull(w.sentAtCol)];
    if (cellFilter) conds.push(eq(registrations.cellId, cellFilter));
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrations)
      .where(and(...conds));
    pendingCounts[w.label] = row?.count ?? 0;
  }

  const rows = active
    ? await db
        .select({
          id: registrations.id,
          firstName: registrations.firstName,
          lastName: registrations.lastName,
          whatsapp: registrations.whatsapp,
          cellId: registrations.cellId,
        })
        .from(registrations)
        .where(
          and(
            isNull(active.sentAtCol),
            ...(cellFilter ? [eq(registrations.cellId, cellFilter)] : []),
          ),
        )
        .orderBy(asc(registrations.createdAt))
        .limit(500)
    : [];

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Lembretes manuais</h1>
          <p className="text-sm text-gray-600">
            Fallback caso o Twilio esteja fora.
            {hoursUntilEvent >= 0 ? (
              <> Faltam <strong>{hoursUntilEvent.toFixed(1)}h</strong> para o evento.</>
            ) : (
              <> Evento já ocorreu.</>
            )}
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          ← Voltar
        </Link>
      </header>

      {/* Window selector */}
      <section className="rounded-md border bg-amber-50 border-amber-200 p-4 space-y-3">
        <p className="text-sm text-amber-900">
          <strong>Como usar:</strong> 1) abra WhatsApp no botão verde,
          2) envie a mensagem manualmente, 3) clique &quot;Marcar enviado&quot;
          para que o cron automático não envie de novo quando o Twilio voltar.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {WINDOWS.map((w) => {
            const isActive = active?.label === w.label;
            const params = new URLSearchParams();
            params.set('window', w.label);
            if (cellFilter) params.set('cell', cellFilter);
            return (
              <Link
                key={w.label}
                href={`/admin/reminders?${params.toString()}`}
                className={`rounded px-3 py-1.5 font-medium ${
                  isActive
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-amber-300 hover:bg-amber-100'
                }`}
              >
                Lembrete {w.label} · {pendingCounts[w.label]} pendentes
              </Link>
            );
          })}
        </div>
      </section>

      {/* Cell filter */}
      <form className="flex gap-2 items-end">
        <label className="block text-sm">
          <span className="block text-gray-700 mb-1">Filtrar cell</span>
          <select
            name="cell"
            defaultValue={cellFilter}
            className="border rounded px-2 py-1.5"
          >
            <option value="">Todas</option>
            {Object.values(CELL_CONFIG).map((c) => (
              <option key={c.cellId} value={c.cellId}>
                {c.cityLabel}
              </option>
            ))}
          </select>
        </label>
        {sp.window && (
          <input type="hidden" name="window" value={sp.window} />
        )}
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Filtrar
        </button>
      </form>

      {/* Worklist */}
      {!active ? (
        <div className="rounded border bg-gray-50 p-6 text-center text-sm text-gray-600">
          Nenhuma janela de lembrete está aberta no momento. O evento começa em{' '}
          {hoursUntilEvent.toFixed(1)}h — a primeira janela abre em T-48h.
          Você pode forçar uma janela acima.
        </div>
      ) : (
        <section>
          <div className="text-sm text-gray-600 mb-2">
            Janela ativa: <strong>{active.label}</strong> ·{' '}
            {rows.length} pendentes
          </div>
          <div className="overflow-x-auto border rounded bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">Nome</th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    WhatsApp
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">Cell</th>
                  <th className="px-3 py-2 font-medium text-gray-700">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center text-gray-500 py-6"
                    >
                      Tudo enviado nesta janela. ✓
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const text = buildReminderText(r.firstName, active.untilLabel);
                  const waLink = buildWaMeLink(r.whatsapp, text);
                  return (
                    <ManualRow
                      key={r.id}
                      id={r.id}
                      firstName={r.firstName}
                      lastName={r.lastName}
                      whatsapp={r.whatsapp}
                      cityLabel={cellLabel(r.cellId)}
                      waLink={waLink}
                      window={active.label}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Show the exact text for transparency / copy-paste */}
          <details className="mt-3 text-xs text-gray-600">
            <summary className="cursor-pointer">
              Ver texto da mensagem (todas usam o mesmo)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 border p-3 font-mono">
              {buildReminderText('{Nome}', active.untilLabel)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
