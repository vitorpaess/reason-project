import Link from "next/link";
import { fetchParesTable, fetchSetores, type ParesSort } from "@/lib/pares-repo";
import type { Estado } from "@/lib/pairs-data";
import { statusColor, statusLabel } from "@/lib/theme";
import { StatusPill } from "@/components/StatusPill";
import { ParesTableControls } from "@/components/ParesTableControls";
import { buildQuery } from "@/lib/url-params";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SORT_VALUES: ParesSort[] = ["z_desc", "z_asc", "correlacao_desc", "correlacao_asc", "par_asc"];
const STATUS_VALUES: Estado[] = [
  "oportunidade_entrada",
  "oportunidade_saida",
  "em_operacao",
  "espera",
];

function param(sp: { [key: string]: string | string[] | undefined }, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  current,
  align = "left",
}: {
  label: string;
  sortKey: ParesSort;
  currentSort: ParesSort;
  current: Record<string, string | undefined>;
  align?: "left" | "right";
}) {
  const ativo = currentSort === sortKey;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        href={`/dashboard${buildQuery(current, { sort: sortKey, page: undefined })}`}
        className={`transition-colors hover:text-ink-primary ${ativo ? "text-ink-primary" : ""}`}
      >
        {label}
      </Link>
    </th>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const search = param(sp, "q");
  const setor = param(sp, "setor");
  const statusRaw = param(sp, "status");
  const status = STATUS_VALUES.includes(statusRaw as Estado) ? (statusRaw as Estado) : undefined;
  const sortRaw = param(sp, "sort");
  const sort = SORT_VALUES.includes(sortRaw as ParesSort) ? (sortRaw as ParesSort) : "z_desc";
  const pageRaw = Number(param(sp, "page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const current: Record<string, string | undefined> = {
    q: search,
    setor,
    status,
    sort: sort === "z_desc" ? undefined : sort,
  };

  const [{ rows, total }, setores] = await Promise.all([
    fetchParesTable({ search, setor, status, sort, page, pageSize: PAGE_SIZE }),
    fetchSetores(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-primary">Pares</h1>
        <span className="text-sm text-ink-muted">{total.toLocaleString("pt-BR")} pares</span>
      </div>

      <ParesTableControls setores={setores} />

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3 text-left font-medium">Par</th>
              <th className="px-4 py-3 text-left font-medium">Setor</th>
              <SortHeader label="Z-score" sortKey="z_desc" currentSort={sort} current={current} align="right" />
              <SortHeader
                label="Correlação"
                sortKey="correlacao_desc"
                currentSort={sort}
                current={current}
                align="right"
              />
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.par} className="border-b border-border last:border-0 hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <Link
                    href={`/pair/${row.tickerA}-${row.tickerB}`}
                    className="font-medium text-ink-primary hover:underline"
                  >
                    {row.par}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-secondary">{row.setor}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-primary">
                  {row.zScore !== null ? row.zScore.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-primary">
                  {row.correlacao !== null ? row.correlacao.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.estado ? (
                    <StatusPill label={statusLabel[row.estado]} color={statusColor(row.estado)} />
                  ) : (
                    <span className="text-xs text-ink-muted">aguardando histórico</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                  Nenhum par encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
          <Link
            href={`/dashboard${buildQuery(current, { page: page > 1 ? page - 1 : undefined })}`}
            aria-disabled={page <= 1}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              page <= 1
                ? "pointer-events-none opacity-40"
                : "text-ink-secondary hover:bg-surface-raised hover:text-ink-primary"
            }`}
          >
            Anterior
          </Link>
          <span>
            Página {page} de {totalPages}
          </span>
          <Link
            href={`/dashboard${buildQuery(current, { page: page < totalPages ? page + 1 : undefined })}`}
            aria-disabled={page >= totalPages}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "text-ink-secondary hover:bg-surface-raised hover:text-ink-primary"
            }`}
          >
            Próxima
          </Link>
        </div>
      )}
    </div>
  );
}
