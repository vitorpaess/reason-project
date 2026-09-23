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

export function estadoFromRow(zScore: number | null, posicaoAberta: boolean): Estado | null {
  if (zScore === null) return null;
  const az = Math.abs(zScore);
  if (posicaoAberta) {
    return az < EXIT_THRESHOLD ? "oportunidade_saida" : "em_operacao";
  }
  return az > ENTRY_THRESHOLD ? "oportunidade_entrada" : "espera";
}

export type ParComSetor = PairDef & { setor: string };

/** Todos os pares configurados, com setor — usado pelo ranking de
 * oportunidades (lib/ranking-repo.ts), que precisa da lista completa (não
 * paginada como fetchParesTable) pra computar o ranking sobre o universo
 * inteiro de pares antes de qualquer filtro de tela. */
export async function fetchTodosPares(): Promise<ParComSetor[]> {
  const pares: ParComSetor[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase()
      .from("pares_config")
      .select("ticker_a,ticker_b,setor")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Falha ao buscar pares: ${error.message}`);
    for (const row of data ?? []) {
      pares.push({ ...toPairDef(row), setor: row.setor as string });
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return pares;
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
