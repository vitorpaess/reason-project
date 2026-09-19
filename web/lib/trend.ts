/**
 * Regressão linear simples (mínimos quadrados) sobre uma série temporal,
 * usada pra estimar a tendência da correlação móvel e projetar um valor
 * futuro. É uma extrapolação simples do período visível, não um modelo
 * estatístico robusto — correlação tende a reverter à média, não a
 * seguir uma reta indefinidamente, então isso só faz sentido como leitura
 * de curto prazo.
 */

export type Trend = {
  slopePerDay: number;
  ultimo: number;
  projetado: number; // clampado em [-1, 1]
  direcao: "subindo" | "caindo" | "estavel";
};

const SLOPE_ESTAVEL_LIMIAR = 0.0008; // variação por dia abaixo disso conta como "estável"

export function linearTrend(values: number[], horizonteDias: number): Trend | null {
  const n = values.length;
  if (n < 2) return null;

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (values[i] - yMean);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  const projetadoBruto = intercept + slope * (n - 1 + horizonteDias);
  const projetado = Math.max(-1, Math.min(1, projetadoBruto));

  const direcao: Trend["direcao"] =
    Math.abs(slope) < SLOPE_ESTAVEL_LIMIAR ? "estavel" : slope > 0 ? "subindo" : "caindo";

  return { slopePerDay: slope, ultimo: values[n - 1], projetado, direcao };
}
