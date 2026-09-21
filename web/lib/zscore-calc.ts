// Porta em TypeScript do cálculo de z-score/correlação de compute_zscore.py
// (mesma matemática, mesmos parâmetros) — computado sob demanda a partir do
// preço bruto (lib/company-prices.ts), não lido de uma tabela pré-calculada.
// Isso existe porque guardar o histórico calculado dos ~7,9 mil pares no
// Supabase estourou o armazenamento do projeto; o preço bruto é barato de
// guardar e permite recalcular a série inteira a qualquer momento.

import { ROLLING_WINDOW_DAYS } from "./config";
import type { PricePoint } from "./company-prices";
import type { ZScoreRow } from "./pairs-data";

const MIN_PERIODS = 2;

// ---- Modo do spread (parâmetro configurável) ---------------------------
// "normalizado" (original): (precoA/precoA0) - (precoB/precoB0), ancorado
// no preço do PRIMEIRO dia de todo o histórico disponível (hoje, ~5 anos
// atrás) — faz o desvio-padrão do spread inflar quando um dos dois ativos
// teve uma reavaliação estrutural grande desde então, mesmo que os
// RETORNOS diários continuem bem correlacionados (ver diagnóstico de
// AAOI/VIAV, sigma=252%).
// "log": ln(precoA) - ln(precoB), 1:1, sem hedge ratio — não ancorado em
// nenhum preço específico, então não carrega esse viés histórico.
// Ainda "normalizado" por padrão: o ranking e as páginas de par continuam
// no comportamento já validado até a comparação entre os dois ser decidida.
export type SpreadMode = "log" | "normalizado";
export const SPREAD_MODE: SpreadMode = "normalizado";

function computeSpread(precoA: number[], precoB: number[], modo: SpreadMode): number[] {
  if (modo === "log") {
    return precoA.map((v, i) => Math.log(v) - Math.log(precoB[i]));
  }
  const precoAInicial = precoA[0];
  const precoBInicial = precoB[0];
  return precoA.map((v, i) => v / precoAInicial - precoB[i] / precoBInicial);
}
// --------------------------------------------------------------------------

function pctChange(values: number[]): (number | null)[] {
  const out: (number | null)[] = [null];
  for (let i = 1; i < values.length; i++) {
    const anterior = values[i - 1];
    out.push(anterior === 0 ? null : (values[i] - anterior) / anterior);
  }
  return out;
}

function media(janela: number[]): number {
  return janela.reduce((a, b) => a + b, 0) / janela.length;
}

// ddof=1 (desvio-padrão amostral) — igual ao default do pandas .std(),
// necessário pra bater exatamente com o valor calculado no backend Python.
function desvioPadrao(janela: number[]): number {
  const m = media(janela);
  const somaSqDiff = janela.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(somaSqDiff / (janela.length - 1));
}

function rollingStat(
  values: (number | null)[],
  window: number,
  minPeriods: number,
  reduce: (janela: number[]) => number
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const janela = values
      .slice(start, i + 1)
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    out.push(janela.length < minPeriods ? null : reduce(janela));
  }
  return out;
}

function rollingCorr(
  a: (number | null)[],
  b: (number | null)[],
  window: number,
  minPeriods: number
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window + 1);
    const pares: [number, number][] = [];
    for (let k = start; k <= i; k++) {
      const x = a[k];
      const y = b[k];
      if (x !== null && y !== null && !Number.isNaN(x) && !Number.isNaN(y)) pares.push([x, y]);
    }
    if (pares.length < minPeriods) {
      out.push(null);
      continue;
    }
    const mx = pares.reduce((s, [x]) => s + x, 0) / pares.length;
    const my = pares.reduce((s, [, y]) => s + y, 0) / pares.length;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const [x, y] of pares) {
      const dx = x - mx;
      const dy = y - my;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    out.push(den === 0 ? null : num / den);
  }
  return out;
}

export function computeZScoreSeries(
  precosA: PricePoint[],
  precosB: PricePoint[],
  modo: SpreadMode = SPREAD_MODE
): ZScoreRow[] {
  const mapaB = new Map(precosB.map((p) => [p.data, p.preco]));
  const datasComuns = precosA
    .map((p) => p.data)
    .filter((d) => mapaB.has(d))
    .sort();

  if (datasComuns.length === 0) return [];

  const mapaA = new Map(precosA.map((p) => [p.data, p.preco]));
  const precoA = datasComuns.map((d) => mapaA.get(d) as number);
  const precoB = datasComuns.map((d) => mapaB.get(d) as number);

  const window = ROLLING_WINDOW_DAYS;
  const retornoA = pctChange(precoA);
  const retornoB = pctChange(precoB);
  const correlacao = rollingCorr(retornoA, retornoB, window, MIN_PERIODS);

  const spread = computeSpread(precoA, precoB, modo);

  const mediaMovel = rollingStat(spread, window, MIN_PERIODS, media);
  const desvioMovel = rollingStat(spread, window, MIN_PERIODS, desvioPadrao);
  const zScore = spread.map((s, i) => {
    const m = mediaMovel[i];
    const d = desvioMovel[i];
    if (m === null || d === null || d === 0) return null;
    return (s - m) / d;
  });

  return datasComuns.map((data, i) => ({
    data,
    z_score_63d: zScore[i],
    correlacao_movel_63d: correlacao[i],
    spread: spread[i],
    retorno_a: retornoA[i],
    retorno_b: retornoB[i],
    // Mesmo desvio-padrão usado no denominador do z-score, exposto aqui pra
    // lib/ranking.ts converter |z| em % esperado de movimento do spread sem
    // recalcular a janela móvel — nos dois modos, spread já está em fração
    // do valor por ponta (em "normalizado" porque o preço é normalizado a 1
    // no início da série; em "log" porque ln(A)-ln(B) aproxima direto a
    // variação percentual pra oscilações do tamanho que o spread costuma
    // ter), então esse desvio já sai em "% do valor da operação" nos dois.
    desvio_spread_63d: desvioMovel[i],
  }));
}
