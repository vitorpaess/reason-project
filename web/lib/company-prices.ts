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
