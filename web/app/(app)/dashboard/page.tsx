import { fetchSetores, estadoFromRow } from "@/lib/pares-repo";
import { fetchRanking, type RankingRowComEstado } from "@/lib/ranking-repo";
import { fetchTodosParesComPosicaoAberta } from "@/lib/positions";
import type { Estado } from "@/lib/pairs-data";
import { ParesFilterBar } from "@/components/ParesFilterBar";
import { RankingTable } from "@/components/RankingTable";

export const dynamic = "force-dynamic";

type RankingSort = "score_desc" | "score_asc" | "z_desc" | "z_asc" | "par_asc";
const SORT_VALUES: RankingSort[] = ["score_desc", "score_asc", "z_desc", "z_asc", "par_asc"];
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

function ordenar(rows: RankingRowComEstado[], sort: RankingSort): RankingRowComEstado[] {
  const ordenado = [...rows];
  switch (sort) {
    case "score_asc":
      return ordenado.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
    case "z_desc":
      return ordenado.sort((a, b) => Math.abs(b.zAtual ?? 0) - Math.abs(a.zAtual ?? 0));
    case "z_asc":
      return ordenado.sort((a, b) => Math.abs(a.zAtual ?? 0) - Math.abs(b.zAtual ?? 0));
    case "par_asc":
      return ordenado.sort((a, b) => a.par.localeCompare(b.par));
    case "score_desc":
    default:
      // Já vem ordenado por score desc de finalizarRanking — mantém.
      return ordenado;
  }
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const search = param(sp, "q");
  const setor = param(sp, "setor");
  const statusRaw = param(sp, "status");
  const status = STATUS_VALUES.includes(statusRaw as Estado) ? (statusRaw as Estado) : undefined;
  const sortRaw = param(sp, "sort");
  const sort = SORT_VALUES.includes(sortRaw as RankingSort) ? (sortRaw as RankingSort) : "score_desc";

  const [ranking, setores, posicoesAbertas] = await Promise.all([
    fetchRanking(),
    fetchSetores(),
    // À parte de fetchRanking (que tem cache de 24h): entrar/sair de posição
    // precisa refletir no estado exibido na hora, não só no dia seguinte.
    fetchTodosParesComPosicaoAberta(),
  ]);

  const comEstado: RankingRowComEstado[] = ranking.map((r) => {
    const posicaoAberta = posicoesAbertas.has(r.par);
    return { ...r, posicaoAberta, estado: estadoFromRow(r.zAtual, posicaoAberta) };
  });

  const termo = search?.trim().toUpperCase();
  const filtrado = comEstado.filter((r) => {
    if (termo && !r.tickerA.includes(termo) && !r.tickerB.includes(termo)) return false;
    if (setor && r.setor !== setor) return false;
    if (status && r.estado !== status) return false;
    return true;
  });

  const rows = ordenar(filtrado, sort);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-primary">Pares</h1>
        <span className="text-sm text-ink-muted">{ranking.length.toLocaleString("pt-BR")} pares</span>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-sm font-semibold text-ink-secondary">Ranking de oportunidades</h2>
        <ParesFilterBar setores={setores} />
        <div className="mt-4">
          <RankingTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
