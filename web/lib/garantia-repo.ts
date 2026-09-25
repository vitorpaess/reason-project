import "server-only";
import { unstable_cache } from "next/cache";
import { fetchDadosBase, precosParaMapa } from "./dados-base-repo";
import { computeZScoreSeries } from "./zscore-calc";
import { extrairOperacoes, type Operacao } from "./operacoes-historicas";

/**
 * Todas as operações históricas reais de todos os pares (entrada até
 * sucesso/stop/prazo), achatadas numa lista só, ordenadas por data de
 * entrada — insumo da calculadora de garantia (components/
 * GarantiaCalculadora.tsx), que roda a simulação de portfólio (quantas
 * operações cabem na garantia disponível) inteiramente no navegador. Mesmo
 * princípio de lib/ranking-repo.ts: busca o preço de todos os tickers numa
 * passada só e cacheia por 24h (o preço só muda 1x/dia).
 */
async function fetchTodasOperacoesSemCache(): Promise<Operacao[]> {
  const { pares, precos: precosArray } = await fetchDadosBase();
  if (pares.length === 0) return [];

  const precos = precosParaMapa(precosArray);

  const todas: Operacao[] = [];
  for (const p of pares) {
    const rows = computeZScoreSeries(precos.get(p.a) ?? [], precos.get(p.b) ?? []);
    todas.push(...extrairOperacoes(p.label, p.setor, rows));
  }

  // Só operações que passariam nos filtros de qualidade do ranking (ver
  // motivosNaEntrada em lib/operacoes-historicas.ts) — sem isso, a
  // calculadora contaria cruzamentos de z de pares que o próprio ranking
  // reprova (correlação baixa, quebra estrutural recente, hedge ratio
  // instável), inflando MUITO o número de operações e derrubando a taxa de
  // sucesso pra bem abaixo do que o ranking real produziria.
  const qualificadas = todas.filter((o) => o.motivos.length === 0);

  qualificadas.sort((a, b) => (a.dataEntrada < b.dataEntrada ? -1 : a.dataEntrada > b.dataEntrada ? 1 : 0));
  return qualificadas;
}

export const fetchTodasOperacoes = unstable_cache(fetchTodasOperacoesSemCache, ["operacoes-historicas"], {
  tags: ["ranking"],
  revalidate: 24 * 60 * 60,
});
