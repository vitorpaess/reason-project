import "server-only";
import { unstable_cache } from "next/cache";
import { fetchTodosPares, type ParComSetor } from "./pares-repo";
import { fetchPriceSeriesForTickers, type PricePoint } from "./company-prices";

export type DadosBase = {
  pares: ParComSetor[];
  // Array, não Map — unstable_cache precisa de um valor serializável em
  // JSON pra funcionar corretamente fora do cache em memória do dev server
  // (um Map viraria "{}" na volta). Consumidores reconstroem o Map
  // localmente (ver precosParaMapa abaixo).
  precos: [string, PricePoint[]][];
};

/**
 * Busca em lote (pares + preço de todos os tickers) compartilhada por
 * lib/ranking-repo.ts e lib/garantia-repo.ts — sem isso, os dois
 * recalculariam a mesma busca (~120 requisições paralelas ao Supabase) de
 * forma independente na primeira visita ao dashboard após o cache de 24h
 * expirar, quase dobrando o tempo de carregamento a frio.
 */
async function fetchDadosBaseSemCache(): Promise<DadosBase> {
  const pares = await fetchTodosPares();
  if (pares.length === 0) return { pares: [], precos: [] };

  const tickers = Array.from(new Set(pares.flatMap((p) => [p.a, p.b])));
  const precos = await fetchPriceSeriesForTickers(tickers);
  return { pares, precos: Array.from(precos.entries()) };
}

// Cache curto (não os 24h do ranking/operações) — só existe pra achatar as
// duas chamadas simultâneas de fetchRanking/fetchTodasOperacoes numa busca
// só quando as duas estão frias ao mesmo tempo (caso comum: primeira visita
// do dia). unstable_cache dedupe automaticamente chamadas concorrentes com
// a mesma chave dentro da janela de revalidação.
export const fetchDadosBase = unstable_cache(fetchDadosBaseSemCache, ["dados-base"], {
  tags: ["ranking"],
  revalidate: 60 * 10,
});

export function precosParaMapa(precos: [string, PricePoint[]][]): Map<string, PricePoint[]> {
  return new Map(precos);
}
