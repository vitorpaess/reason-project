import "server-only";
import { supabase } from "./supabase";

export type PricePoint = { data: string; preco: number };

const PAGE_SIZE = 1000; // teto padrão do PostgREST por requisição

// ~5 anos de histórico já passam de 1000 dias úteis — sem paginar, o
// Supabase corta na resposta e (por vir ordenado por data crescente)
// derruba justo os dias mais RECENTES, que são os que mais importam pro
// z-score atual.
export async function fetchCompanyPriceSeries(ticker: string): Promise<PricePoint[]> {
  const rows: PricePoint[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase()
      .from("precos_diarios")
      .select("data,preco_fechamento")
      .eq("ticker", ticker)
      .order("data", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Falha ao ler precos_diarios para ${ticker}: ${error.message}`);
    }
    for (const r of data ?? []) {
      rows.push({ data: r.data, preco: r.preco_fechamento });
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/**
 * Busca o preço de vários tickers numa passada só, paginando em paralelo —
 * usado pelo ranking de oportunidades (lib/ranking-repo.ts), que precisa do
 * histórico completo de todos os tickers referenciados pelos pares atuais
 * de uma vez. Buscar 1 ticker por vez (fetchCompanyPriceSeries) exigiria
 * 2 requisições sequenciais por par — inviável com ~150 pares.
 */
export async function fetchPriceSeriesForTickers(
  tickers: string[]
): Promise<Map<string, PricePoint[]>> {
  const porTicker = new Map<string, PricePoint[]>(tickers.map((t) => [t, []]));
  if (tickers.length === 0) return porTicker;

  const { count, error: countError } = await supabase()
    .from("precos_diarios")
    .select("*", { count: "exact", head: true })
    .in("ticker", tickers);
  if (countError) {
    throw new Error(`Falha ao contar precos_diarios: ${countError.message}`);
  }

  const total = count ?? 0;
  const paginas = Math.ceil(total / PAGE_SIZE);

  const respostas = await Promise.all(
    Array.from({ length: paginas }, (_, p) =>
      supabase()
        .from("precos_diarios")
        .select("ticker,data,preco_fechamento")
        .in("ticker", tickers)
        .order("ticker", { ascending: true })
        .order("data", { ascending: true })
        .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1)
    )
  );

  for (const { data, error } of respostas) {
    if (error) throw new Error(`Falha ao ler precos_diarios em lote: ${error.message}`);
    for (const r of data ?? []) {
      porTicker.get(r.ticker)?.push({ data: r.data, preco: r.preco_fechamento });
    }
  }

  return porTicker;
}
