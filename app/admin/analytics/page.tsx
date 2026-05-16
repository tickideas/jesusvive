/**
 * Watch-page viewer analytics.
 *
 * Reads watch_sessions rows captured by the WatchTracker beacon. Shows per-
 * cell totals, current concurrents, watch-duration medians, and UTM-source
 * breakdowns.
 *
 * Watch duration per session = coalesce(ended_at, last_heartbeat_at) -
 * started_at. Sessions <10s are excluded from duration stats (bounce noise).
 *
 * Auto-refreshes every 30s via <meta http-equiv="refresh">.
 */

import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { CELL_CONFIG } from '@/lib/cells';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONCURRENT_WINDOW_SEC = 90; // sessions whose heartbeat is within 90s

interface CellRow {
  cellId: string;
  sessions: number;
  uniqueIps: number;
  concurrent: number;
  medianSec: number | null;
  p90Sec: number | null;
  avgSec: number | null;
}

interface UtmRow {
  source: string;
  sessions: number;
  medianSec: number | null;
}

interface RecentRow {
  startedAt: Date;
  endedAt: Date | null;
  cellId: string;
  durationSec: number;
  utmSource: string | null;
  utmCampaign: string | null;
  isMobile: boolean | null;
  referrer: string | null;
}

function cellLabel(cellId: string): string {
  for (const c of Object.values(CELL_CONFIG)) {
    if (c.cellId === cellId) return c.cityLabel;
  }
  return cellId;
}

function fmtDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  // Default window = last 24h. Other accepted values: 1h, 6h, 7d, all.
  const windowKey = sp.window || '24h';
  // `now` is read at request entry (server action / RSC render scope), not
  // during a component re-render — but the lint rule can't tell the
  // difference, so we explicitly pin it before any JSX runs.
  const now = new Date();
  const since = (() => {
    const t = now.getTime();
    switch (windowKey) {
      case '1h':
        return new Date(t - 60 * 60_000);
      case '6h':
        return new Date(t - 6 * 60 * 60_000);
      case '7d':
        return new Date(t - 7 * 24 * 60 * 60_000);
      case 'all':
        return null;
      case '24h':
      default:
        return new Date(t - 24 * 60 * 60_000);
    }
  })();

  // All durations clamp negative/null using greatest(... , 0).
  const sinceFilter = since
    ? sql`where started_at >= ${since}`
    : sql``;

  const perCellSql = sql<CellRow>`
    with sess as (
      select
        cell_id,
        ip_hash,
        extract(epoch from (coalesce(ended_at, last_heartbeat_at) - started_at))::float as dur,
        case
          when last_heartbeat_at >= now() - (${CONCURRENT_WINDOW_SEC} || ' seconds')::interval
               and ended_at is null
          then 1 else 0
        end as is_live
      from watch_sessions
      ${sinceFilter}
    )
    select
      cell_id as "cellId",
      count(*)::int as "sessions",
      count(distinct ip_hash)::int as "uniqueIps",
      coalesce(sum(is_live), 0)::int as "concurrent",
      percentile_cont(0.5) within group (order by dur) filter (where dur >= 10) as "medianSec",
      percentile_cont(0.9) within group (order by dur) filter (where dur >= 10) as "p90Sec",
      avg(dur) filter (where dur >= 10) as "avgSec"
    from sess
    group by cell_id
    order by cell_id
  `;

  const utmSql = sql<UtmRow>`
    with sess as (
      select
        coalesce(nullif(utm_source, ''), '(direct)') as source,
        extract(epoch from (coalesce(ended_at, last_heartbeat_at) - started_at))::float as dur
      from watch_sessions
      ${sinceFilter}
    )
    select
      source,
      count(*)::int as "sessions",
      percentile_cont(0.5) within group (order by dur) filter (where dur >= 10) as "medianSec"
    from sess
    group by source
    order by count(*) desc
    limit 20
  `;

  const recentSql = sql<RecentRow>`
    select
      started_at as "startedAt",
      ended_at as "endedAt",
      cell_id as "cellId",
      extract(epoch from (coalesce(ended_at, last_heartbeat_at) - started_at))::float as "durationSec",
      utm_source as "utmSource",
      utm_campaign as "utmCampaign",
      is_mobile as "isMobile",
      referrer as "referrer"
    from watch_sessions
    ${sinceFilter}
    order by started_at desc
    limit 50
  `;

  const concurrentTotalSql = sql<{ count: number }>`
    select count(*)::int as count
    from watch_sessions
    where ended_at is null
      and last_heartbeat_at >= now() - (${CONCURRENT_WINDOW_SEC} || ' seconds')::interval
  `;

  const [perCellRaw, utmRaw, recentRaw, concurrentRaw] = await Promise.all([
    db.execute(perCellSql),
    db.execute(utmSql),
    db.execute(recentSql),
    db.execute(concurrentTotalSql),
  ]);

  const perCell = perCellRaw as unknown as CellRow[];
  const utm = utmRaw as unknown as UtmRow[];
  const recent = recentRaw as unknown as RecentRow[];
  const concurrentNow =
    (concurrentRaw as unknown as { count: number }[])[0]?.count ?? 0;

  const grandSessions = perCell.reduce((a, r) => a + (r.sessions ?? 0), 0);
  const grandUniques = perCell.reduce((a, r) => a + (r.uniqueIps ?? 0), 0);

  // Ensure every cell appears even with zero rows.
  const perCellByCell = new Map(perCell.map((r) => [r.cellId, r]));
  const allCells = Object.values(CELL_CONFIG).map((c) => {
    return (
      perCellByCell.get(c.cellId) ?? {
        cellId: c.cellId,
        sessions: 0,
        uniqueIps: 0,
        concurrent: 0,
        medianSec: null,
        p90Sec: null,
        avgSec: null,
      }
    );
  });

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Auto-refresh every 30s for live ops view. */}
      <meta httpEquiv="refresh" content="30" />

      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics — Watch pages</h1>
          <p className="text-sm text-gray-600">
            Visitas, tempo de permanência e fonte de tráfego em /ao-vivo/*.
            Atualiza a cada 30s.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            ← Voltar
          </Link>
        </div>
      </header>

      {/* Window selector */}
      <nav className="flex gap-2 text-sm">
        {(
          [
            ['1h', 'Última hora'],
            ['6h', 'Últimas 6h'],
            ['24h', 'Últimas 24h'],
            ['7d', 'Últimos 7 dias'],
            ['all', 'Tudo'],
          ] as const
        ).map(([key, label]) => (
          <a
            key={key}
            href={`/admin/analytics?window=${key}`}
            className={`rounded px-3 py-1.5 border ${
              windowKey === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Top stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Sessões" value={grandSessions.toLocaleString('pt-BR')} />
        <StatCard
          label="Visitantes únicos (IP)"
          value={grandUniques.toLocaleString('pt-BR')}
          sublabel="aprox."
        />
        <StatCard
          label="Assistindo agora"
          value={concurrentNow.toLocaleString('pt-BR')}
          accent
          sublabel={`heartbeat < ${CONCURRENT_WINDOW_SEC}s`}
        />
        <StatCard
          label="Janela"
          value={
            since
              ? since.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
              : 'Tudo'
          }
          sublabel="desde"
        />
      </section>

      {/* Per-cell breakdown */}
      <section>
        <h2 className="font-semibold mb-2">Por célula</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <Th>Célula</Th>
                <Th>Sessões</Th>
                <Th>Únicos (IP)</Th>
                <Th>Ao vivo agora</Th>
                <Th>Tempo médio</Th>
                <Th>Mediana</Th>
                <Th>p90</Th>
              </tr>
            </thead>
            <tbody>
              {allCells.map((r) => (
                <tr key={r.cellId} className="border-t">
                  <Td>
                    <span className="font-medium">{cellLabel(r.cellId)}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.cellId}</span>
                  </Td>
                  <Td>{r.sessions.toLocaleString('pt-BR')}</Td>
                  <Td>{r.uniqueIps.toLocaleString('pt-BR')}</Td>
                  <Td>
                    <span className={r.concurrent > 0 ? 'font-bold text-emerald-700' : ''}>
                      {r.concurrent}
                    </span>
                  </Td>
                  <Td>{fmtDuration(r.avgSec)}</Td>
                  <Td>{fmtDuration(r.medianSec)}</Td>
                  <Td>{fmtDuration(r.p90Sec)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tempo de permanência exclui sessões &lt; 10s (bounces). Para sessões
          ainda ativas, conta do início até o último heartbeat.
        </p>
      </section>

      {/* UTM breakdown */}
      <section>
        <h2 className="font-semibold mb-2">Origem do tráfego (UTM source)</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <Th>Source</Th>
                <Th>Sessões</Th>
                <Th>Tempo mediano</Th>
              </tr>
            </thead>
            <tbody>
              {utm.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 py-4">
                    Nenhuma sessão na janela.
                  </td>
                </tr>
              )}
              {utm.map((r) => (
                <tr key={r.source} className="border-t">
                  <Td>{r.source}</Td>
                  <Td>{r.sessions.toLocaleString('pt-BR')}</Td>
                  <Td>{fmtDuration(r.medianSec)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Use links com <code>?utm_source=facebook&amp;utm_campaign=...</code> nos
          anúncios para validar quais campanhas trazem audiência real.
        </p>
      </section>

      {/* Recent sessions */}
      <section>
        <h2 className="font-semibold mb-2">Sessões recentes (50)</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <Th>Início</Th>
                <Th>Célula</Th>
                <Th>Tempo</Th>
                <Th>Status</Th>
                <Th>Disp.</Th>
                <Th>UTM source</Th>
                <Th>UTM campaign</Th>
                <Th>Referrer</Th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-4">
                    Nenhuma sessão na janela.
                  </td>
                </tr>
              )}
              {recent.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <Td>{fmtDateTime(new Date(r.startedAt))}</Td>
                  <Td>{cellLabel(r.cellId)}</Td>
                  <Td>{fmtDuration(r.durationSec)}</Td>
                  <Td>
                    {r.endedAt ? (
                      <span className="text-gray-500">encerrada</span>
                    ) : (
                      <span className="font-semibold text-emerald-700">ao vivo</span>
                    )}
                  </Td>
                  <Td>{r.isMobile === null ? '—' : r.isMobile ? '📱' : '🖥️'}</Td>
                  <Td>{r.utmSource || '—'}</Td>
                  <Td>{r.utmCampaign || '—'}</Td>
                  <Td className="max-w-xs truncate">{r.referrer || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-xs text-gray-500 pt-4">
        Telemetria 100% própria (tabela <code>watch_sessions</code>). Sem cookies
        de terceiros. IPs armazenados como hash SHA-256 truncado.
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
  value: string | number;
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
      <div className="text-2xl font-bold">{value}</div>
      {sublabel && <div className="text-xs text-gray-400">{sublabel}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-gray-700">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 whitespace-nowrap ${className ?? ''}`}>
      {children}
    </td>
  );
}
