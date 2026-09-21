import Link from "next/link";
import { fetchParesTable, fetchSetores, type ParesSort } from "@/lib/pares-repo";
import { fetchRanking } from "@/lib/ranking-repo";
import type { Estado } from "@/lib/pairs-data";
import { ParesFilterBar } from "@/components/ParesFilterBar";
import { ParSquare } from "@/components/ParSquare";
import { RankingTable } from "@/components/RankingTable";
import { buildQuery } from "@/lib/url-params";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;
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

  const [{ rows, total }, setores, ranking] = await Promise.all([
    fetchParesTable({ search, setor, status, sort, page, pageSize: PAGE_SIZE }),
    fetchSetores(),
    fetchRanking(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const scorePorPar = new Map(ranking.map((r) => [r.par, r.score]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-primary">Pares</h1>
        <span className="text-sm text-ink-muted">{total.toLocaleString("pt-BR")} pares</span>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-sm font-semibold text-ink-secondary">Ranking de oportunidades</h2>
        <RankingTable rows={ranking} />
      </div>

      <ParesFilterBar setores={setores} />

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-muted">Nenhum par encontrado.</p>
      ) : (
        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
          {rows.map((row) => (
            <ParSquare key={row.par} row={row} score={scorePorPar.get(row.par) ?? null} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-ink-muted">
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
