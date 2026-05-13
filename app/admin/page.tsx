/**
 * Admin dashboard — leads viewer with filters and CSV export.
 *
 * Auth: basic-auth via middleware.ts (ADMIN_USERNAME / ADMIN_PASSWORD env).
 * Renders server-side on each request. Indexes on (cell_id, created_at)
 * keep this fast even at tens of thousands of rows.
 */

import { and, desc, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { registrations, whatsappMessages } from '@/lib/schema';
import { CELL_CONFIG, type CellSlug } from '@/lib/cells';
import { DeleteRowButton } from './DeleteRowButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{
  cell?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
}>;

const PAGE_SIZE = 100;

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function cellLabel(cellId: string): string {
  for (const c of Object.values(CELL_CONFIG)) {
    if (c.cellId === cellId) return c.cityLabel;
  }
  return cellId;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const cellFilter = sp.cell?.trim() || '';
  const sourceFilter = sp.source?.trim() || '';
  const from = parseDate(sp.from);
  const to = parseDate(sp.to);
  const q = sp.q?.trim() || '';

  const conditions: SQL[] = [];
  if (cellFilter) conditions.push(eq(registrations.cellId, cellFilter));
  if (sourceFilter) conditions.push(eq(registrations.source, sourceFilter));
  if (from) conditions.push(gte(registrations.createdAt, from));
  if (to) conditions.push(lte(registrations.createdAt, to));
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${registrations.firstName}) like ${like}
        or lower(${registrations.lastName}) like ${like}
        or lower(coalesce(${registrations.email}, '')) like ${like}
        or ${registrations.whatsapp} like ${like})`,
    );
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [rows, totalsByCell, totalsBySource, totalsLast24h, unreadInboxRows] =
    await Promise.all([
    db
      .select()
      .from(registrations)
      .where(whereClause)
      .orderBy(desc(registrations.createdAt))
      .limit(PAGE_SIZE),

    db
      .select({
        cellId: registrations.cellId,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .groupBy(registrations.cellId),

    db
      .select({
        source: registrations.source,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .groupBy(registrations.source),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrations)
      .where(
        gte(
          registrations.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        ),
      ),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.direction, 'in'),
          isNull(whatsappMessages.readAt),
        ),
      ),
  ]);

  const grandTotal = totalsByCell.reduce((a, r) => a + r.count, 0);
  const last24h = totalsLast24h[0]?.count ?? 0;
  const unreadInbox = unreadInboxRows[0]?.count ?? 0;

  const exportParams = new URLSearchParams();
  if (cellFilter) exportParams.set('cell', cellFilter);
  if (sourceFilter) exportParams.set('source', sourceFilter);
  if (sp.from) exportParams.set('from', sp.from);
  if (sp.to) exportParams.set('to', sp.to);
  if (q) exportParams.set('q', q);

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Jesus Vive Brasil — Admin</h1>
          <p className="text-sm text-gray-600">Registrations dashboard</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/inbox"
            className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Inbox
            {unreadInbox > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                {unreadInbox}
              </span>
            )}
          </a>
          <a
            href="/admin/streams"
            className="inline-flex items-center rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Gerenciar streams
          </a>
          <a
            href={`/api/admin/leads.csv?${exportParams.toString()}`}
            className="inline-flex items-center rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Export CSV
          </a>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total inscrições" value={grandTotal} />
        <StatCard label="Últimas 24h" value={last24h} accent />
        {totalsByCell.map((r) => (
          <StatCard
            key={r.cellId}
            label={cellLabel(r.cellId)}
            value={r.count}
            sublabel={r.cellId}
          />
        ))}
      </section>

      {/* Filters */}
      <form className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 p-4 rounded">
        <Field label="Cell">
          <select
            name="cell"
            defaultValue={cellFilter}
            className="w-full border rounded px-2 py-1.5"
          >
            <option value="">Todas</option>
            {Object.values(CELL_CONFIG).map((c) => (
              <option key={c.cellId} value={c.cellId}>
                {c.cityLabel} ({c.cellId})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select
            name="source"
            defaultValue={sourceFilter}
            className="w-full border rounded px-2 py-1.5"
          >
            <option value="">Todos</option>
            {totalsBySource.map((s) => (
              <option key={s.source} value={s.source}>
                {s.source} ({s.count})
              </option>
            ))}
          </select>
        </Field>
        <Field label="De">
          <input
            type="date"
            name="from"
            defaultValue={sp.from || ''}
            className="w-full border rounded px-2 py-1.5"
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            name="to"
            defaultValue={sp.to || ''}
            className="w-full border rounded px-2 py-1.5"
          />
        </Field>
        <Field label="Buscar (nome/email/whatsapp)">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Maria, +5511..."
            className="w-full border rounded px-2 py-1.5"
          />
        </Field>
        <div className="md:col-span-5 flex gap-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filtrar
          </button>
          <a
            href="/admin"
            className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-100"
          >
            Limpar
          </a>
        </div>
      </form>

      {/* Table */}
      <section>
        <div className="text-sm text-gray-600 mb-2">
          Mostrando {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
          {rows.length === PAGE_SIZE && ` (limite: ${PAGE_SIZE} — refine os filtros para ver mais)`}
        </div>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <Th>Data</Th>
                <Th>Nome</Th>
                <Th>WhatsApp</Th>
                <Th>Email</Th>
                <Th>Cidade</Th>
                <Th>Cell</Th>
                <Th>Source</Th>
                <Th>UTM source</Th>
                <Th>UTM campaign</Th>
                <Th>Conf.</Th>
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center text-gray-500 py-6"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <Td>{fmtDateTime(r.createdAt)}</Td>
                  <Td>
                    {r.firstName} {r.lastName}
                  </Td>
                  <Td>
                    <a
                      href={`https://wa.me/${r.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {r.whatsapp}
                    </a>
                  </Td>
                  <Td>{r.email || '—'}</Td>
                  <Td>{r.city || '—'}</Td>
                  <Td>{cellLabel(r.cellId)}</Td>
                  <Td>{r.source}</Td>
                  <Td>{r.utmSource || '—'}</Td>
                  <Td>{r.utmCampaign || '—'}</Td>
                  <Td>{r.confirmationSentAt ? '✓' : '—'}</Td>
                  <Td>
                    <DeleteRowButton
                      id={r.id}
                      name={`${r.firstName} ${r.lastName}`}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-xs text-gray-500 pt-4">
        Para análise de tráfego, anúncios e cliques: Meta Ads Manager (Pixel ID
        já instalado).
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: number;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded border p-3 ${
        accent ? 'bg-emerald-50 border-emerald-200' : 'bg-white'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString('pt-BR')}</div>
      {sublabel && <div className="text-xs text-gray-400">{sublabel}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-gray-700">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}

// satisfy TS unused-import check for CellSlug (kept for future per-cell auth)
void (null as unknown as CellSlug);
