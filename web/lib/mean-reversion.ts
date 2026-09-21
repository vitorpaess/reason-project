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
// Card "tempo fora do equilíbrio ÷ meia-vida": limiares de cor (múltiplos
// da mediana histórica da meia-vida longa).
export const POSICAO_RATIO_AMARELO = 1;
export const POSICAO_RATIO_VERMELHO = 2;
// CUSUM: limite de detecção de quebra = CUSUM_THRESHOLD * sqrt(n) do
// segmento em análise (convenção comum de carta de controle CUSUM —
// Page/Brown-Durbin-Evans usam limites na mesma ordem de grandeza pra uma
// soma cumulativa padronizada). Só mostra o selo se a quebra mais recente
// aconteceu dentro dos últimos CUSUM_RECENTE_DIAS dias corridos.
export const CUSUM_THRESHOLD = 4;
export const CUSUM_RECENTE_DIAS = 30;
// Correlação mínima pro selo verde (mesmo limiar já usado no resto do app).
export const CORRELACAO_MINIMA_SAUDAVEL = 0.5;
// ------------------------------------------------------------------------

function diasEntreDatas(a: string, b: string): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / msPorDia);
}

export type HalfLifePoint = {
  data: string;
  /** null se não há amostra suficiente na janela, OU se semReversao=true
   * (a meia-vida só existe matematicamente quando b < 0). */
  meiaVida: number | null;
  /** b >= 0 nessa janela — o spread não está revertendo à média local da
   * janela, só tendendo (ou é um passeio aleatório). Importante: isso mede
   * reversão em torno da média DA JANELA, não da média histórica de longo
   * prazo — se o patamar do spread mudou e ficou ali por boa parte da
   * janela, a regressão pode achar reversão rápida em torno do NOVO
   * patamar mesmo com o z-score (calculado contra a média histórica) bem
   * longe de zero. Por isso o card de quebra estrutural (CUSUM) e o
   * indicador de tempo fora do equilíbrio existem como sinais
   * complementares, não redundantes. */
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

/**
 * Dias corridos (na série) desde a última vez que |z| esteve dentro da
 * zona de equilíbrio (< limiarSaida) — contado direto sobre o z-score, não
 * via o histórico de oportunidades (que usa o limiar de ENTRADA, mais
 * estrito, pra abrir/fechar; um mergulho rápido abaixo do limiar de
 * entrada mas ainda fora da zona de equilíbrio reabriria uma "nova"
 * oportunidade e esconderia quanto tempo o spread já está deslocado no
 * total). null se |z| nunca esteve dentro da zona em todo o histórico
 * disponível, ou se não há z calculado.
 */
export function diasForaDoEquilibrio(rows: ZScoreRow[], limiarSaida: number): number | null {
  let dias = 0;
  let achouZ = false;
  for (let i = rows.length - 1; i >= 0; i--) {
    const z = rows[i].z_score_63d;
    if (z === null) continue;
    achouZ = true;
    if (Math.abs(z) < limiarSaida) return dias;
    dias++;
  }
  return achouZ ? dias : null;
}

export type CusumResultado = {
  series: { data: string; valor: number | null }[];
  /** Data da quebra mais recente, só quando ela está dentro de
   * CUSUM_RECENTE_DIAS do dado mais atual — null caso contrário (nenhuma
   * quebra, ou só quebras antigas já "absorvidas"). */
  quebraData: string | null;
};

function media(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function desvioPadrao(valores: number[], m: number): number {
  return Math.sqrt(valores.reduce((acc, v) => acc + (v - m) ** 2, 0) / (valores.length - 1));
}

/**
 * CUSUM sequencial sobre a série de spread (tratada como os resíduos da
 * relação entre os dois ativos — é exatamente o que o spread já
 * representa: o desvio da co-movimentação normalizada dos dois preços).
 *
 * Diferente de um CUSUM de passagem única: sempre que a soma cumulativa
 * passa do limite, a média/desvio de referência são RECALCULADOS a partir
 * dali (o segmento pós-quebra vira a nova base) e a varredura continua —
 * assim uma quebra antiga que já foi absorvida (o spread se estabilizou
 * num novo patamar e voltou a reverter normalmente) não deixa o selo
 * aceso pra sempre, e uma quebra mais recente dentro do mesmo histórico
 * ainda é detectável.
 */
export function computeCUSUM(rows: ZScoreRow[]): CusumResultado {
  const valores: (number | null)[] = rows.map((r) => r.spread);
  const seriesCompleta: (number | null)[] = new Array(rows.length).fill(null);

  let inicioSegmento = 0;
  let ultimaQuebraIdx: number | null = null;

  // Máximo de segmentos processados — proteção contra loop, nunca deveria
  // chegar perto disso na prática (cada quebra avança o início em >=1).
  for (let iteracao = 0; iteracao < rows.length; iteracao++) {
    const segmentoValores = valores
      .slice(inicioSegmento)
      .filter((v): v is number => v !== null);
    if (segmentoValores.length < 2) break;

    const m = media(segmentoValores);
    const d = desvioPadrao(segmentoValores, m);
    const limite = CUSUM_THRESHOLD * Math.sqrt(segmentoValores.length);

    let acumulado = 0;
    let quebraIdxNoSegmento: number | null = null;
    for (let i = inicioSegmento; i < rows.length; i++) {
      const v = valores[i];
      if (v === null || d === 0) continue;
      acumulado += (v - m) / d;
      seriesCompleta[i] = acumulado;
      if (quebraIdxNoSegmento === null && Math.abs(acumulado) > limite) {
        quebraIdxNoSegmento = i;
      }
    }

    if (quebraIdxNoSegmento === null) break;
    ultimaQuebraIdx = quebraIdxNoSegmento;
    inicioSegmento = quebraIdxNoSegmento + 1;
    if (inicioSegmento >= rows.length) break;
  }

  const series = rows.map((r, i) => ({ data: r.data, valor: seriesCompleta[i] }));

  if (ultimaQuebraIdx === null || rows.length === 0) {
    return { series, quebraData: null };
  }

  const quebraData = rows[ultimaQuebraIdx].data;
  const dataMaisRecente = rows[rows.length - 1].data;
  const recente = diasEntreDatas(quebraData, dataMaisRecente) <= CUSUM_RECENTE_DIAS;

  return { series, quebraData: recente ? quebraData : null };
}
