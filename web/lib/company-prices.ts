import "server-only";
import { supabase } from "./supabase";

export type PricePoint = { data: string; preco: number };

export async function fetchCompanyPriceSeries(ticker: string): Promise<PricePoint[]> {
  const { data, error } = await supabase()
    .from("precos_diarios")
    .select("data,preco_fechamento")
    .eq("ticker", ticker)
    .order("data", { ascending: true });

  if (error) {
    throw new Error(`Falha ao ler precos_diarios para ${ticker}: ${error.message}`);
  }
  return (data ?? []).map((r: { data: string; preco_fechamento: number }) => ({
    data: r.data,
    preco: r.preco_fechamento,
  }));
}
