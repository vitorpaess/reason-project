import "server-only";
import { unstable_cache } from "next/cache";
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
async function fetchRankingSemCache(): Promise<RankingRow[]> {
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

// fetchRankingSemCache busca o histórico inteiro de todos os tickers (~150
// pares) e roda meia-vida/CUSUM/beta/ADF/Engle-Granger/taxa de reversão pra
// cada um — o caminho mais pesado do app. A página do dashboard
// (dashboard/page.tsx) chama isso a cada carregamento; sem cache, isso
// significava recalcular tudo do zero em toda visita (~1min, dominado por
// ~120 requisições paralelas ao Supabase buscando preço). Os preços só
// mudam 1x por dia (run_daily.py, via cron) — não há motivo pra recalcular
// mais que isso, então o resultado fica em cache por 24h (revalidação por
// tempo, não por evento: o cron não avisa o Next.js quando termina).
export const fetchRanking = unstable_cache(fetchRankingSemCache, ["ranking"], {
  tags: ["ranking"],
  revalidate: 24 * 60 * 60,
});
