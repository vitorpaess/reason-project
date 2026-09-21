// Pequenos helpers reusados por mais de um gráfico Recharts da página do
// par (HalfLifeChart, HedgeRatioChart) — mantidos separados dos módulos de
// cálculo (mean-reversion.ts) porque são puramente de apresentação.

/** Amostra até `maxTicks` datas igualmente espaçadas por índice (não por
 * pixel) — ao contrário do sampling automático do Recharts pra eixo de
 * categoria, isso garante ordem cronológica por construção, já que só
 * percorre o array (já ordenado) uma vez pra frente. */
export function pickTicks(dates: string[], maxTicks: number): string[] {
  if (dates.length <= maxTicks) return dates;
  const passo = (dates.length - 1) / (maxTicks - 1);
  const escolhidas: string[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const idx = Math.min(dates.length - 1, Math.round(i * passo));
    escolhidas.push(dates[idx]);
  }
  return Array.from(new Set(escolhidas));
}
