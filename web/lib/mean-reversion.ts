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

export function diasEntreDatas(a: string, b: string): number {
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
  /** Índice/data da quebra mais recente encontrada, independente de ser
   * "recente" ou não — usado pra comparar o hedge ratio antes/depois dela.
   * null se nenhuma quebra foi detectada em todo o histórico. */
  ultimaQuebraIdx: number | null;
  ultimaQuebraData: string | null;
  /** Igual a ultimaQuebraData, mas só preenchido quando ela está dentro de
   * CUSUM_RECENTE_DIAS do dado mais atual — é o que decide se o selo de
   * alerta aparece (uma quebra antiga já "absorvida" não fica presa nele
   * pra sempre). */
  quebraRecenteData: string | null;
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
    return { series, ultimaQuebraIdx: null, ultimaQuebraData: null, quebraRecenteData: null };
  }

  const quebraData = rows[ultimaQuebraIdx].data;
  const dataMaisRecente = rows[rows.length - 1].data;
  const recente = diasEntreDatas(quebraData, dataMaisRecente) <= CUSUM_RECENTE_DIAS;

  return {
    series,
    ultimaQuebraIdx,
    ultimaQuebraData: quebraData,
    quebraRecenteData: recente ? quebraData : null,
  };
}

// ---- Estabilidade do hedge ratio (beta móvel) -------------------------
// Janela da regressão de beta móvel (retorno_a ~ retorno_b), dias úteis.
export const BETA_WINDOW = 63;
// Diferença relativa mínima (em relação a |betaAntes|) pra marcar a
// mudança de beta ao redor de uma quebra como "relevante".
export const BETA_MUDANCA_RELEVANTE = 0.25;

export type BetaPoint = { data: string; beta: number | null };

export function rollingBeta(rows: ZScoreRow[], window: number): BetaPoint[] {
  const retA = rows.map((r) => r.retorno_a);
  const retB = rows.map((r) => r.retorno_b);

  return rows.map((row, i) => {
    const start = Math.max(0, i - window + 1);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = start; k <= i; k++) {
      const a = retA[k];
      const b = retB[k];
      if (a !== null && b !== null) {
        xs.push(b);
        ys.push(a);
      }
    }
    return { data: row.data, beta: coeficienteB(xs, ys) };
  });
}

function betaDoSegmento(segmento: ZScoreRow[]): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of segmento) {
    if (r.retorno_a !== null && r.retorno_b !== null) {
      xs.push(r.retorno_b);
      ys.push(r.retorno_a);
    }
  }
  return coeficienteB(xs, ys);
}

export type BetaComparacao = {
  betaAntes: number | null;
  betaDepois: number | null;
  mudancaRelevante: boolean;
};

/**
 * Compara o hedge ratio médio nos `janela` dias antes vs depois de um
 * índice de quebra (de computeCUSUM) — responde diretamente "a relação
 * entre os dois ativos mudou, ou é só o spread que se deslocou e volta a
 * reverter com o mesmo beta de sempre?". Complementa o CUSUM: uma quebra
 * com beta estável é mais provável de ser um deslocamento de nível
 * temporário; uma quebra com beta bem diferente sugere reestimar os
 * parâmetros do par.
 */
export function compararBetaAoRedorDaQuebra(
  rows: ZScoreRow[],
  quebraIdx: number,
  janela: number
): BetaComparacao {
  const antes = rows.slice(Math.max(0, quebraIdx - janela), quebraIdx);
  const depois = rows.slice(quebraIdx + 1, quebraIdx + 1 + janela);

  const betaAntes = betaDoSegmento(antes);
  const betaDepois = betaDoSegmento(depois);
  const mudancaRelevante =
    betaAntes !== null &&
    betaDepois !== null &&
    betaAntes !== 0 &&
    Math.abs(betaDepois - betaAntes) > BETA_MUDANCA_RELEVANTE * Math.abs(betaAntes);

  return { betaAntes, betaDepois, mudancaRelevante };
}

// ---- Teste de raiz unitária (ADF) --------------------------------------
// Número de defasagens (lags) de Δy na regressão aumentada — um valor
// pequeno e fixo, não uma seleção automática por AIC/BIC (mantém o cálculo
// simples e determinístico; 1 já captura a autocorrelação de curto prazo
// mais comum em spreads diários).
export const ADF_LAGS = 1;

// Valores críticos assintóticos padrão (MacKinnon, especificação "com
// constante, sem tendência") pro teste ADF — os mesmos citados em
// praticamente qualquer referência de econometria pra essa especificação.
// Reportamos a FAIXA de significância que o teste atinge, não um p-valor
// contínuo interpolado: a superfície de resposta exata de MacKinnon usada
// por bibliotecas como o statsmodels depende de coeficientes polinomiais
// tabelados que não temos confiança suficiente em reproduzir de memória
// com precisão — preferimos a faixa correta a um número com precisão
// inventada.
const ADF_CRITICO_1PCT = -3.43;
const ADF_CRITICO_5PCT = -2.86;
const ADF_CRITICO_10PCT = -2.57;

export type AdfResultado = {
  tau: number;
  pFaixa: "< 0.01" | "< 0.05" | "< 0.10" | "≥ 0.10";
  estacionario: boolean; // pFaixa < 0.05 — limiar padrão de significância
};

function multiplicarXtX(X: number[][]): number[][] {
  const k = X[0].length;
  const linhas = X.length;
  const resultado: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let soma = 0;
      for (let l = 0; l < linhas; l++) soma += X[l][i] * X[l][j];
      resultado[i][j] = soma;
    }
  }
  return resultado;
}

function multiplicarXtY(X: number[][], y: number[]): number[] {
  const k = X[0].length;
  const linhas = X.length;
  const resultado = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    let soma = 0;
    for (let l = 0; l < linhas; l++) soma += X[l][i] * y[l];
    resultado[i] = soma;
  }
  return resultado;
}

/** Inversa de matriz quadrada via eliminação de Gauss-Jordan com pivô
 * parcial — usada só pra matrizes pequenas (poucos regressores do ADF),
 * não precisa de nada mais sofisticado. */
function inverterMatriz(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((linha, i) => [
    ...linha,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let linhaPivo = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[linhaPivo][col])) linhaPivo = r;
    }
    if (Math.abs(A[linhaPivo][col]) < 1e-12) return null; // singular
    [A[col], A[linhaPivo]] = [A[linhaPivo], A[col]];

    const pivo = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= pivo;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const fator = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= fator * A[col][j];
    }
  }

  return A.map((linha) => linha.slice(n));
}

function ols(X: number[][], y: number[]): { coef: number[]; se: number[] } | null {
  const XtX = multiplicarXtX(X);
  const XtXinv = inverterMatriz(XtX);
  if (XtXinv === null) return null;

  const XtY = multiplicarXtY(X, y);
  const k = X[0].length;
  const n = X.length;

  const coef = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    let soma = 0;
    for (let j = 0; j < k; j++) soma += XtXinv[i][j] * XtY[j];
    coef[i] = soma;
  }

  let ssr = 0;
  for (let l = 0; l < n; l++) {
    let previsto = 0;
    for (let j = 0; j < k; j++) previsto += X[l][j] * coef[j];
    const residuo = y[l] - previsto;
    ssr += residuo * residuo;
  }
  const grausLiberdade = n - k;
  if (grausLiberdade <= 0) return null;
  const sigma2 = ssr / grausLiberdade;

  const se = new Array(k).fill(0);
  for (let i = 0; i < k; i++) se[i] = Math.sqrt(sigma2 * XtXinv[i][i]);

  return { coef, se };
}

/**
 * Augmented Dickey-Fuller sobre o spread inteiro disponível (não é um
 * indicador móvel como a meia-vida — usa o máximo de histórico, igual a
 * um filtro de qualidade estático do par, e por isso reage devagar a
 * mudanças recentes, mesma limitação da meia-vida longa).
 *
 * Regressão: Δy(t) = alpha + gamma*y(t-1) + Σ delta_i*Δy(t-i) + ε(t),
 * testando H0: gamma=0 (raiz unitária, não estacionário) vs H1: gamma<0
 * (estacionário/reverte à média). tau = gamma_hat / erro-padrão(gamma_hat).
 */
export function adfTest(rows: ZScoreRow[], lags: number = ADF_LAGS): AdfResultado | null {
  const y = rows.map((r) => r.spread).filter((v): v is number => v !== null);
  const n = y.length;
  if (n < lags + 10) return null; // amostra curta demais pra um teste confiável

  const delta: number[] = [];
  for (let i = 1; i < n; i++) delta.push(y[i] - y[i - 1]);
  // delta[i] = Δy(i+1)

  const X: number[][] = [];
  const alvo: number[] = [];
  for (let t = lags + 1; t <= n - 1; t++) {
    const linha = [1, y[t - 1]];
    for (let l = 1; l <= lags; l++) linha.push(delta[t - l - 1]);
    X.push(linha);
    alvo.push(delta[t - 1]);
  }
  if (X.length < X[0].length + 5) return null;

  const resultado = ols(X, alvo);
  if (resultado === null) return null;

  const tau = resultado.coef[1] / resultado.se[1];
  const pFaixa: AdfResultado["pFaixa"] =
    tau < ADF_CRITICO_1PCT
      ? "< 0.01"
      : tau < ADF_CRITICO_5PCT
        ? "< 0.05"
        : tau < ADF_CRITICO_10PCT
          ? "< 0.10"
          : "≥ 0.10";

  return { tau, pFaixa, estacionario: tau < ADF_CRITICO_5PCT };
}
