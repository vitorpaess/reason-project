// Indicadores de reversão à média do spread — substituem o gráfico de
// correlação móvel na página do par. Toda a matemática aqui é pura
// (sem I/O): recebe a série de ZScoreRow já calculada (lib/zscore-calc.ts /
// lib/pairs-data.ts) e deriva os indicadores em cima do `spread` e do
// `z_score_63d` que já existem — nenhum dado novo é buscado.

import type { ZScoreRow } from "./pairs-data";

// ---- Parâmetros configuráveis ----------------------------------------
// Janelas da meia-vida móvel (dias úteis).
export const HALFLIFE_SHORT_WINDOW = 50;
export const HALFLIFE_LONG_WINDOW = 200;
// Alerta quando a meia-vida curta for maior que este múltiplo da longa.
export const HALFLIFE_ALERT_RATIO = 2;
// Card "tempo em posição ÷ meia-vida": limiares de cor (múltiplos da
// mediana histórica da meia-vida longa).
export const POSICAO_RATIO_AMARELO = 1;
export const POSICAO_RATIO_VERMELHO = 2;
// CUSUM: limite de detecção de quebra = CUSUM_THRESHOLD * sqrt(n),
// convenção comum de carta de controle CUSUM (Page/Brown-Durbin-Evans usam
// limites na mesma ordem de grandeza para uma soma cumulativa padronizada).
export const CUSUM_THRESHOLD = 4;
// Correlação mínima pro selo verde (mesmo limiar já usado no resto do app).
export const CORRELACAO_MINIMA_SAUDAVEL = 0.5;
// ------------------------------------------------------------------------

export type HalfLifePoint = {
  data: string;
  /** null se não há amostra suficiente na janela, OU se semReversao=true
   * (a meia-vida só existe matematicamente quando b < 0). */
  meiaVida: number | null;
  /** b >= 0 nessa janela — o spread não está revertendo à média, só
   * tendendo (ou é um passeio aleatório). */
  semReversao: boolean;
};

/** Coeficiente b de uma regressão linear simples y = a + b*x (mínimos
 * quadrados) — usado tanto pra meia-vida (y=Δs, x=s_lag) quanto reutilizável
 * em geral. */
function coeficienteB(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    num += dx * (y[i] - my);
    den += dx * dx;
  }
  return den === 0 ? null : num / den;
}

/**
 * Meia-vida móvel: em cada dia, regride Δs(t) contra s(t-1) usando os
 * últimos `window` pares (Δs, s_lag), estima b e calcula
 * meia-vida = -ln(2)/b — só válido se b < 0 (spread realmente revertendo;
 * se b >= 0, marca semReversao em vez de um número).
 */
export function rollingHalfLife(rows: ZScoreRow[], window: number): HalfLifePoint[] {
  const spread = rows.map((r) => r.spread);

  return rows.map((_, i) => {
    const inicioBruto = i - window; // precisa de window+1 pontos brutos de spread
    if (inicioBruto < 0) {
      return { data: rows[i].data, meiaVida: null, semReversao: false };
    }

    const deltas: number[] = [];
    const lags: number[] = [];
    for (let t = inicioBruto + 1; t <= i; t++) {
      const atual = spread[t];
      const anterior = spread[t - 1];
      if (atual === null || anterior === null) {
        return { data: rows[i].data, meiaVida: null, semReversao: false };
      }
      deltas.push(atual - anterior);
      lags.push(anterior);
    }

    const b = coeficienteB(lags, deltas);
    if (b === null) return { data: rows[i].data, meiaVida: null, semReversao: false };
    if (b >= 0) return { data: rows[i].data, meiaVida: null, semReversao: true };

    return { data: rows[i].data, meiaVida: -Math.log(2) / b, semReversao: false };
  });
}

export function medianaValida(pontos: HalfLifePoint[]): number | null {
  const valores = pontos.map((p) => p.meiaVida).filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

export type CusumResultado = {
  series: { data: string; valor: number | null }[];
  /** Data do primeiro ponto em que |CUSUM| passou do limite — null se não
   * houve quebra detectada em todo o período. */
  quebraData: string | null;
};

/**
 * CUSUM sobre a série de spread (tratada como os resíduos da relação entre
 * os dois ativos — é exatamente o que o spread já representa: o desvio da
 * co-movimentação normalizada dos dois preços). Padroniza o spread (média/
 * desvio do período inteiro disponível), acumula, e sinaliza o primeiro
 * ponto em que a soma cumulativa passa do limite — indício de que a média
 * do spread mudou de patamar (quebra estrutural na relação do par).
 */
export function computeCUSUM(rows: ZScoreRow[]): CusumResultado {
  const validos = rows.map((r) => r.spread).filter((v): v is number => v !== null);

  if (validos.length < 2) {
    return { series: rows.map((r) => ({ data: r.data, valor: null })), quebraData: null };
  }

  const media = validos.reduce((a, b) => a + b, 0) / validos.length;
  const desvio = Math.sqrt(
    validos.reduce((acc, v) => acc + (v - media) ** 2, 0) / (validos.length - 1)
  );
  const limite = CUSUM_THRESHOLD * Math.sqrt(validos.length);

  let acumulado = 0;
  let quebraData: string | null = null;
  const series = rows.map((r) => {
    if (r.spread === null || desvio === 0) return { data: r.data, valor: null };
    acumulado += (r.spread - media) / desvio;
    if (quebraData === null && Math.abs(acumulado) > limite) {
      quebraData = r.data;
    }
    return { data: r.data, valor: acumulado };
  });

  return { series, quebraData };
}
