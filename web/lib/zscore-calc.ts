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

export function computeZScoreSeries(precosA: PricePoint[], precosB: PricePoint[]): ZScoreRow[] {
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

  const precoAInicial = precoA[0];
  const precoBInicial = precoB[0];
  const spread = precoA.map((v, i) => v / precoAInicial - precoB[i] / precoBInicial);

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
  }));
}
