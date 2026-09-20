import "server-only";
import { supabase } from "./supabase";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD, type PairDef } from "./config";
import type { Estado } from "./pairs-data";

function slugify(tickerA: string, tickerB: string): string {
  return `${tickerA}-${tickerB}`;
}

function toPairDef(row: { ticker_a: string; ticker_b: string }): PairDef {
  return {
    slug: slugify(row.ticker_a, row.ticker_b),
    label: `${row.ticker_a}/${row.ticker_b}`,
    a: row.ticker_a,
    b: row.ticker_b,
  };
}

/** Busca um par pelo slug da URL ("TICKERA-TICKERB") — tickers de bolsa
 * nunca têm hífen, então o split é sempre inequívoco. */
export async function fetchPairBySlug(slug: string): Promise<PairDef | null> {
  const [tickerA, tickerB] = slug.split("-");
  if (!tickerA || !tickerB) return null;

  const { data, error } = await supabase()
    .from("pares_config")
    .select("ticker_a,ticker_b")
    .eq("ticker_a", tickerA)
    .eq("ticker_b", tickerB)
    .maybeSingle();

  if (error) throw new Error(`Falha ao buscar par ${slug}: ${error.message}`);
  return data ? toPairDef(data) : null;
}

/** Confirma se um par (formato "A/B") existe em pares_config — usado pelas
 * rotas de confirmar entrada/saída pra validar o par recebido do cliente,
 * já que não existe mais um array estático pra checar localmente. */
export async function pairExists(par: string): Promise<boolean> {
  const [tickerA, tickerB] = par.split("/");
  if (!tickerA || !tickerB) return false;

  const { data, error } = await supabase()
    .from("pares_config")
    .select("ticker_a")
    .eq("ticker_a", tickerA)
    .eq("ticker_b", tickerB)
    .maybeSingle();

  if (error) throw new Error(`Falha ao validar par ${par}: ${error.message}`);
  return data !== null;
}

export type ParStatusRow = {
  par: string;
  tickerA: string;
  tickerB: string;
  setor: string;
  data: string | null;
  zScore: number | null;
  correlacao: number | null;
  posicaoAberta: boolean;
  estado: Estado | null;
};

function estadoFromRow(zScore: number | null, posicaoAberta: boolean): Estado | null {
  if (zScore === null) return null;
  const az = Math.abs(zScore);
  if (posicaoAberta) {
    return az < EXIT_THRESHOLD ? "oportunidade_saida" : "em_operacao";
  }
  return az > ENTRY_THRESHOLD ? "oportunidade_entrada" : "espera";
}

export type ParesSort = "z_desc" | "z_asc" | "correlacao_desc" | "correlacao_asc" | "par_asc";

export type ParesTableParams = {
  search?: string;
  setor?: string;
  status?: Estado;
  sort?: ParesSort;
  page?: number;
  pageSize?: number;
};

export type ParesTableResult = {
  rows: ParStatusRow[];
  total: number;
  page: number;
  pageSize: number;
};

// pares_status_atual (view) já traz, numa query só, o status calculado mais
// recente de cada par (pares_status) + se tem posição aberta — sem isso
// seria 1 query por par (inviável em ~7.9k pares).
export async function fetchParesTable(params: ParesTableParams): Promise<ParesTableResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase()
    .from("pares_status_atual")
    .select(
      "ticker_a,ticker_b,par,setor,data,z_score_63d,z_abs,correlacao_movel_63d,posicao_aberta",
      { count: "exact" }
    );

  if (params.search) {
    const termo = params.search.trim().toUpperCase();
    if (termo) {
      query = query.or(`ticker_a.ilike.%${termo}%,ticker_b.ilike.%${termo}%`);
    }
  }
  if (params.setor) {
    query = query.eq("setor", params.setor);
  }

  if (params.status === "oportunidade_entrada") {
    query = query
      .eq("posicao_aberta", false)
      .or(`z_score_63d.gt.${ENTRY_THRESHOLD},z_score_63d.lt.${-ENTRY_THRESHOLD}`);
  } else if (params.status === "espera") {
    query = query
      .eq("posicao_aberta", false)
      .gte("z_score_63d", -ENTRY_THRESHOLD)
      .lte("z_score_63d", ENTRY_THRESHOLD);
  } else if (params.status === "em_operacao") {
    query = query
      .eq("posicao_aberta", true)
      .or(`z_score_63d.gte.${EXIT_THRESHOLD},z_score_63d.lte.${-EXIT_THRESHOLD}`);
  } else if (params.status === "oportunidade_saida") {
    query = query
      .eq("posicao_aberta", true)
      .gt("z_score_63d", -EXIT_THRESHOLD)
      .lt("z_score_63d", EXIT_THRESHOLD);
  }

  switch (params.sort) {
    case "z_asc":
      query = query.order("z_abs", { ascending: true, nullsFirst: false });
      break;
    case "correlacao_desc":
      query = query.order("correlacao_movel_63d", { ascending: false, nullsFirst: false });
      break;
    case "correlacao_asc":
      query = query.order("correlacao_movel_63d", { ascending: true, nullsFirst: false });
      break;
    case "par_asc":
      query = query.order("par", { ascending: true });
      break;
    case "z_desc":
    default:
      query = query.order("z_abs", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(`Falha ao buscar tabela de pares: ${error.message}`);

  const rows: ParStatusRow[] = (data ?? []).map((r) => ({
    par: r.par,
    tickerA: r.ticker_a,
    tickerB: r.ticker_b,
    setor: r.setor,
    data: r.data,
    zScore: r.z_score_63d,
    correlacao: r.correlacao_movel_63d,
    posicaoAberta: r.posicao_aberta,
    estado: estadoFromRow(r.z_score_63d, r.posicao_aberta),
  }));

  return { rows, total: count ?? 0, page, pageSize };
}

export async function fetchSetores(): Promise<string[]> {
  // Sem paginação, o Supabase corta em 1000 linhas por padrão — com ~7.9k
  // pares isso poderia esconder setores raros (ex: só 2 pares em "Energy").
  const setores = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase()
      .from("pares_config")
      .select("setor")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Falha ao buscar setores: ${error.message}`);
    for (const row of data ?? []) setores.add(row.setor as string);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return Array.from(setores).sort();
}
