import "server-only";
import { fetchTodosPares } from "./pares-repo";
import { fetchPriceSeriesForTickers } from "./company-prices";
import { computeZScoreSeries } from "./zscore-calc";
import { computeMetricasBrutas, finalizarRanking, type RankingRow } from "./ranking";

/**
 * Monta o ranking de oportunidades pro universo inteiro de pares — busca o
 * preço de todos os tickers referenciados numa passada só (em vez de 2
 * fetches por par), recalcula a série de z-score/spread de cada par sob
 * demanda (mesmo princípio de lib/pairs-data.ts: nada pré-calculado é lido
 * do banco) e aplica lib/ranking.ts.
 */
export async function fetchRanking(): Promise<RankingRow[]> {
  const pares = await fetchTodosPares();
  if (pares.length === 0) return [];

  const tickers = Array.from(new Set(pares.flatMap((p) => [p.a, p.b])));
  const precos = await fetchPriceSeriesForTickers(tickers);

  const brutas = pares.map((p) => {
    const rows = computeZScoreSeries(precos.get(p.a) ?? [], precos.get(p.b) ?? []);
    return computeMetricasBrutas(p.label, p.a, p.b, p.setor, rows);
  });

  return finalizarRanking(brutas);
}
