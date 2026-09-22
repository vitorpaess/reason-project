// Ranking de oportunidades — combina indicadores que já existem (spread,
// z-score, meia-vida, correlação, CUSUM, beta móvel) num score comparável
// entre pares. Módulo puro (sem I/O): recebe a série ZScoreRow já calculada
// de cada par (ver lib/zscore-calc.ts) e devolve as métricas + o score.
// Orquestração (buscar todos os pares/preços e chamar isto em lote) fica em
// lib/ranking-repo.ts.

import type { ZScoreRow } from "./pairs-data";
import {
  BETA_WINDOW,
  adfTest,
  computeCUSUM,
  diasEntreDatas,
  engleGrangerTest,
  medianaValida,
  rollingBeta,
  rollingHalfLife,
  HALFLIFE_LONG_WINDOW,
  type PFaixa,
  type BetaPoint,
} from "./mean-reversion";
import { EXIT_THRESHOLD } from "./config";

// ---- Parâmetros configuráveis ----------------------------------------
// z de saída — mesmo limiar já usado em todo o resto do app (config.EXIT_THRESHOLD).
// Mantido como constante própria aqui (em vez de só reexportar) porque é um
// parâmetro explícito do ranking, não um detalhe emprestado de outro módulo.
export const Z_SAIDA = EXIT_THRESHOLD;
// Stop de risco: |z| a partir do qual a posição é considerada perdida, não
// mais uma oportunidade de entrada — pares com |z| atual além disso saem do
// ranking com o motivo "z além do stop" (ver computeMetricasBrutas).
export const Z_STOP = 3.0;
// Faixa (em |z|) pra considerar uma entrada passada "parecida" com a atual.
export const TOLERANCIA_Z = 0.3;
// prazo_max = este múltiplo × a meia-vida mediana (janela longa) do par —
// medido em linhas da série (~dias úteis), mesma unidade "informal de dias"
// já usada pro resto do app (ex.: HalfLifeChart mostra a meia-vida em "Xd"
// vindo direto da regressão por linha, sem diferenciar dia útil de
// corrido). Ver taxaReversaoHistorica.
export const PRAZO_MAX_MULT_MEIA_VIDA = 2;
// Abaixo disso, a taxa de reversão é marcada "amostra insuficiente" (mas o
// score ainda é calculado — o ajuste por encolhimento abaixo existe
// justamente pra isso).
export const N_MIN = 8;
// Força do encolhimento da taxa de reversão de cada par em direção à taxa
// geral (P_geral, calculada com todos os pares do ranking) — quanto maior,
// mais um par com poucos episódios se parece com a média do universo em vez
// do próprio histórico curto.
export const K_SHRINK = 5;

// Custo por execução e aluguel da ponta vendida — ESTIMATIVAS, não vieram
// de nenhuma fonte de dados do projeto (não há corretora/custodiante
// integrado). Ajuste aqui pros valores reais da sua corretora/ativos antes
// de usar o score pra decisão real; ver explicação no fim da implementação.
export const COMISSAO_PCT = 0.0005; // 0,05% por execução
export const SLIPPAGE_PCT = 0.0005; // 0,05% por execução
export const ALUGUEL_ANUAL_PCT = 0.02; // 2% ao ano sobre a ponta vendida

// Filtros de elegibilidade (aplicados antes do ranking — ver finalizarRanking).
export const CORR_MIN = 0.5;
export const DIAS_SEM_QUEBRA = 60;
export const BETA_VAR_MAX = 0.2; // 20%
// Sem fonte de volume nos dados hoje (a planilha "Preços DATA" só tem
// fechamento) — o filtro de liquidez mínima do enunciado não é aplicado.
// Ver explicação no fim da implementação.

// Selos (não-filtro) de estacionariedade/cointegração: ADF e Engle-Granger
// sobre os últimos JANELA_ESTACIONARIEDADE dias — deliberadamente uma
// janela diferente do ADF de histórico inteiro mostrado na página do par
// (lib/mean-reversion.ts), que reage devagar demais pra ser útil como
// leitura de regime recente. Só informativos: não entram em
// `motivos`/`cinza` nem afetam o score.
export const JANELA_ESTACIONARIEDADE = 200;
// ------------------------------------------------------------------------

function medianaSimples(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

// ---- Métrica 2: taxa de reversão histórica -----------------------------

export type TaxaReversaoBruta = {
  sucessos: number;
  n: number;
  diasMedianosSucesso: number | null;
  /** Média de (|z_fixo| de saída − |z_fixo| de entrada), em σ do dia de
   * entrada de cada episódio (média/desvio travados na entrada, não a
   * janela móvel do dia da saída — ver taxaReversaoHistorica), das falhas
   * deste par — null se numFalhas < 3 (amostra de falhas curta demais pra
   * confiar na média; ver computeMetricasBrutas pro fallback). */
  perdaMediaZ: number | null;
  numFalhas: number;
};

function mediaSimples(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/**
 * Entre as excursões passadas do z-score com |z| dentro de ±TOLERANCIA_Z do
 * valor atual e mesmo sinal (usando o z como era calculado na época — a
 * série de z-score já é isso, não é recalculada), qual fração REALMENTE
 * reverteu antes de bater o stop e dentro de `prazoMaxLinhas` linhas da
 * série. Dias consecutivos dentro da faixa contam como UMA excursão (uma
 * amostra), não uma por dia — do contrário um regime persistente de 40
 * dias inflaria n artificialmente.
 *
 * Desfecho com MÉDIA FIXA: a partir do dia de entrada, o desfecho de cada
 * excursão não é lido de z_score_63d dia a dia — a média e o desvio-padrão
 * do spread são travados no valor do PRÓPRIO dia de entrada
 * (media_spread_63d[i]/desvio_spread_63d[i]) e reaplicados sobre o spread
 * bruto dos dias seguintes. Ler z_score_63d[j] diretamente contaria como
 * "sucesso" um episódio em que o spread nunca voltou perto do nível de
 * entrada — só ficou parado num novo patamar enquanto a janela móvel de
 * 63d arrastava atrás dele até a média "alcançar" o novo nível (ver
 * media_spread_63d em lib/pairs-data.ts). Por construção, no próprio dia
 * de entrada essa métrica fixa é idêntica a z_score_63d[i], então
 * azEntrada não muda.
 *
 * Dia a dia a partir da entrada: sucesso se |z_fixo| < Z_SAIDA antes de
 * |z_fixo| >= Z_STOP; falha se o stop é tocado primeiro OU o prazo esgota
 * sem sucesso (empate no mesmo dia conta como falha — checado nessa ordem,
 * mas os dois são fisicamente exclusivos já que Z_STOP > Z_SAIDA). Falha
 * por prazo encerra no último dia do prazo.
 *
 * Uma excursão só vira amostra se o desfecho é conhecido (sucesso ou falha
 * confirmada). Se o histórico acaba no meio da janela de observação sem
 * nenhum dos dois, a excursão é censurada e descartada — é assim que a
 * excursão ATUAL (ainda em curso) fica de fora da própria amostra que
 * tenta prevê-la.
 */
export function taxaReversaoHistorica(
  rows: ZScoreRow[],
  zAtual: number,
  prazoMaxLinhas: number
): TaxaReversaoBruta {
  const sinal = zAtual >= 0 ? 1 : -1;
  const alvo = Math.abs(zAtual);
  const bandaInf = Math.max(0, alvo - TOLERANCIA_Z);
  const bandaSup = alvo + TOLERANCIA_Z;

  const zs = rows.map((r) => r.z_score_63d);
  const spreads = rows.map((r) => r.spread);
  const mediasFixas = rows.map((r) => r.media_spread_63d);
  const desviosFixos = rows.map((r) => r.desvio_spread_63d);
  const ultimoIdx = rows.length - 1;

  let emBanda = false;
  const sucessosDias: number[] = [];
  const falhasDeltaZ: number[] = [];
  let sucessos = 0;
  let n = 0;

  for (let i = 0; i <= ultimoIdx; i++) {
    const z = zs[i];
    if (z === null) {
      emBanda = false;
      continue;
    }
    const az = Math.abs(z);
    const dentro = Math.sign(z) === sinal && az >= bandaInf && az <= bandaSup;

    if (dentro && !emBanda) {
      const spreadEntrada = spreads[i];
      const mediaFixa = mediasFixas[i];
      const desvioFixo = desviosFixos[i];

      // Não deveria acontecer na prática (media_spread_63d/desvio_spread_63d
      // são computados junto com z_score_63d[i], que já sabemos não-nulo
      // aqui) — guarda de tipo só pra não propagar null silenciosamente.
      if (spreadEntrada === null || mediaFixa === null || desvioFixo === null || desvioFixo === 0) {
        emBanda = dentro;
        continue;
      }

      const azEntrada = az;
      const fimJanela = i + prazoMaxLinhas;
      const fimObservavel = Math.min(fimJanela, ultimoIdx);

      let resultado: "sucesso" | "falha" | null = null;
      let dias: number | null = null;
      let azSaida: number | null = null;

      for (let j = i; j <= fimObservavel; j++) {
        const spreadJ = spreads[j];
        if (spreadJ === null) continue;
        const azFixoJ = Math.abs((spreadJ - mediaFixa) / desvioFixo);
        if (azFixoJ < Z_SAIDA) {
          resultado = "sucesso";
          dias = j - i;
          azSaida = azFixoJ;
          break;
        }
        if (azFixoJ >= Z_STOP) {
          resultado = "falha";
          dias = j - i;
          azSaida = azFixoJ;
          break;
        }
        if (j === fimJanela) {
          resultado = "falha";
          dias = j - i;
          azSaida = azFixoJ;
          break;
        }
      }

      if (resultado !== null) {
        n++;
        if (resultado === "sucesso") {
          sucessos++;
          if (dias !== null) sucessosDias.push(dias);
        } else if (azSaida !== null) {
          falhasDeltaZ.push(azSaida - azEntrada);
        }
      }
      // resultado === null: censurada (série acabou antes do prazo
      // terminar sem sucesso nem stop) — não conta como amostra.
    }
    emBanda = dentro;
  }

  const numFalhas = falhasDeltaZ.length;
  return {
    sucessos,
    n,
    diasMedianosSucesso: medianaSimples(sucessosDias),
    perdaMediaZ: numFalhas >= 3 ? mediaSimples(falhasDeltaZ) : null,
    numFalhas,
  };
}

// ---- Métricas por par ----------------------------------------------------

export type MetricasBrutas = {
  par: string;
  tickerA: string;
  tickerB: string;
  setor: string;
  zAtual: number | null;
  ganho: number | null; // (|z|-Z_SAIDA) × σ_spread
  // Perda realizada em σ_spread atual: média de (|z| saída − |z| entrada)
  // das falhas deste par se numFalhas >= 3, senão (Z_STOP-|z|) × σ_spread
  // como aproximação — ver taxaReversaoHistorica. Null se |z| >= Z_STOP.
  perda: number | null;
  custo: number | null;
  ganhoPorDia: number | null;
  meiaVidaMediana: number | null;
  taxa: TaxaReversaoBruta;
  motivos: string[]; // filtros reprovados / motivos de dado insuficiente
  // Selos informativos, não-filtro — ver JANELA_ESTACIONARIEDADE acima.
  // null = histórico curto demais pra janela (não deveria acontecer com
  // dado real, mas cai como "sem dado" na tela).
  adfPFaixa: PFaixa | null;
  eggPFaixa: PFaixa | null;
};

function ultimoBetaValido(beta: BetaPoint[]): { idx: number; valor: number } | null {
  for (let i = beta.length - 1; i >= 0; i--) {
    if (beta[i].beta !== null) return { idx: i, valor: beta[i].beta as number };
  }
  return null;
}

export function computeMetricasBrutas(
  par: string,
  tickerA: string,
  tickerB: string,
  setor: string,
  rows: ZScoreRow[]
): MetricasBrutas {
  const motivos: string[] = [];

  if (rows.length === 0) {
    return {
      par,
      tickerA,
      tickerB,
      setor,
      zAtual: null,
      ganho: null,
      perda: null,
      custo: null,
      ganhoPorDia: null,
      meiaVidaMediana: null,
      taxa: { sucessos: 0, n: 0, diasMedianosSucesso: null, perdaMediaZ: null, numFalhas: 0 },
      motivos: ["Sem dados de preço"],
      adfPFaixa: null,
      eggPFaixa: null,
    };
  }

  const ultimo = rows[rows.length - 1];
  const zAtual = ultimo.z_score_63d;
  const sigma = ultimo.desvio_spread_63d;
  const longa = rollingHalfLife(rows, HALFLIFE_LONG_WINDOW);
  const meiaVidaMediana = medianaValida(longa);
  const janelaRecente = rows.slice(-JANELA_ESTACIONARIEDADE);
  const adfPFaixa = adfTest(janelaRecente)?.pFaixa ?? null;
  const eggPFaixa = engleGrangerTest(janelaRecente)?.pFaixa ?? null;

  // Filtro: correlação móvel atual.
  const correlacao = ultimo.correlacao_movel_63d;
  if (correlacao === null || Math.abs(correlacao) <= CORR_MIN) {
    motivos.push(
      `Correlação baixa (${correlacao !== null ? correlacao.toFixed(2) : "N/D"})`
    );
  }

  // Filtro: quebra estrutural (CUSUM) recente.
  const cusum = computeCUSUM(rows);
  if (cusum.ultimaQuebraData !== null) {
    const dias = diasEntreDatas(cusum.ultimaQuebraData, ultimo.data);
    if (dias <= DIAS_SEM_QUEBRA) {
      motivos.push(`Quebra estrutural recente (${cusum.ultimaQuebraData})`);
    }
  }

  // Filtro: variação do hedge ratio (beta móvel) na janela recente — compara
  // o beta atual contra o beta de BETA_WINDOW linhas atrás (mesma janela já
  // usada pro beta móvel no resto do app). Sem dado suficiente, o filtro
  // não reprova (não penaliza par com histórico curto por falta de dado).
  const beta = rollingBeta(rows, BETA_WINDOW);
  const betaAtual = ultimoBetaValido(beta);
  if (betaAtual) {
    const idxAnterior = betaAtual.idx - BETA_WINDOW;
    const betaAnterior = idxAnterior >= 0 ? beta[idxAnterior].beta : null;
    if (betaAnterior !== null && betaAnterior !== 0) {
      const variacao = Math.abs(betaAtual.valor - betaAnterior) / Math.abs(betaAnterior);
      if (variacao > BETA_VAR_MAX) {
        motivos.push(`Hedge ratio instável (${(variacao * 100).toFixed(0)}%)`);
      }
    }
  }

  if (zAtual === null || sigma === null || meiaVidaMediana === null) {
    motivos.push("Histórico insuficiente");
    return {
      par,
      tickerA,
      tickerB,
      setor,
      zAtual,
      ganho: null,
      perda: null,
      custo: null,
      ganhoPorDia: null,
      meiaVidaMediana,
      taxa: { sucessos: 0, n: 0, diasMedianosSucesso: null, perdaMediaZ: null, numFalhas: 0 },
      motivos,
      adfPFaixa,
      eggPFaixa,
    };
  }

  const az = Math.abs(zAtual);
  const ganho = (az - Z_SAIDA) * sigma;
  const ganhoPorDia = ganho / meiaVidaMediana;

  const prazoMaxLinhas = Math.round(PRAZO_MAX_MULT_MEIA_VIDA * meiaVidaMediana);
  const taxa = taxaReversaoHistorica(rows, zAtual, prazoMaxLinhas);

  let perda: number | null = null;
  if (az >= Z_STOP) {
    motivos.push(`Z além do stop (${zAtual.toFixed(2)})`);
  } else {
    // Perda realizada: média das falhas deste par (|z| saída − |z| entrada,
    // pode ser negativa) se houver pelo menos 3; com menos falhas a média
    // amostral é ruído demais pra confiar, então cai de volta na
    // aproximação formulaica (distância até o stop a partir do z atual).
    const perdaZ = taxa.numFalhas >= 3 ? (taxa.perdaMediaZ as number) : Z_STOP - az;
    perda = perdaZ * sigma;
  }

  const custo =
    4 * (COMISSAO_PCT + SLIPPAGE_PCT) + (ALUGUEL_ANUAL_PCT / 252) * meiaVidaMediana;

  return {
    par,
    tickerA,
    tickerB,
    setor,
    zAtual,
    ganho,
    perda,
    custo,
    ganhoPorDia,
    meiaVidaMediana,
    taxa,
    motivos,
    adfPFaixa,
    eggPFaixa,
  };
}

// ---- Finalização: P_geral, score e ordenação -----------------------------

export type RankingRow = {
  par: string;
  tickerA: string;
  tickerB: string;
  setor: string;
  zAtual: number | null;
  ganhoPorDia: number | null;
  taxaReversao: {
    pAjustada: number;
    n: number;
    sucessos: number;
    diasMedianosSucesso: number | null;
    amostraInsuficiente: boolean;
  };
  custoEstimado: number | null;
  score: number | null;
  motivos: string[];
  cinza: boolean;
  // Selos informativos (ADF e Engle-Granger sobre os últimos
  // JANELA_ESTACIONARIEDADE dias) — não entram em `cinza`/`motivos` nem
  // afetam `score` ou a ordenação.
  adfPFaixa: PFaixa | null;
  eggPFaixa: PFaixa | null;
  tickerACount: number;
  tickerBCount: number;
  melhorParTickerA: boolean;
  melhorParTickerB: boolean;
};

export function finalizarRanking(brutas: MetricasBrutas[]): RankingRow[] {
  let totalSucessos = 0;
  let totalN = 0;
  for (const b of brutas) {
    totalSucessos += b.taxa.sucessos;
    totalN += b.taxa.n;
  }
  // Taxa média de todos os pares (pooled: soma de sucessos ÷ soma de
  // episódios, não a média simples das taxas por par) — usada como o "P
  // geral" que o encolhimento por amostra pequena puxa cada par em direção.
  // 0.5 é só um piso neutro pro caso degenerado de nenhum par ter episódio
  // nenhum (não deveria acontecer com dado real).
  const pGeral = totalN > 0 ? totalSucessos / totalN : 0.5;

  const linhas: RankingRow[] = brutas.map((b) => {
    const pAjustada = (b.taxa.sucessos + K_SHRINK * pGeral) / (b.taxa.n + K_SHRINK);
    const amostraInsuficiente = b.taxa.n < N_MIN;

    let score: number | null = null;
    if (b.ganho !== null && b.perda !== null && b.custo !== null && b.meiaVidaMediana !== null) {
      const retornoLiquido = pAjustada * b.ganho - (1 - pAjustada) * b.perda - b.custo;
      score = retornoLiquido / b.meiaVidaMediana;
    }

    const cinza =
      b.motivos.length > 0 || amostraInsuficiente || score === null || score < 0;

    return {
      par: b.par,
      tickerA: b.tickerA,
      tickerB: b.tickerB,
      setor: b.setor,
      zAtual: b.zAtual,
      ganhoPorDia: b.ganhoPorDia,
      taxaReversao: {
        pAjustada,
        n: b.taxa.n,
        sucessos: b.taxa.sucessos,
        diasMedianosSucesso: b.taxa.diasMedianosSucesso,
        amostraInsuficiente,
      },
      custoEstimado: b.custo,
      score,
      motivos: b.motivos,
      cinza,
      adfPFaixa: b.adfPFaixa,
      eggPFaixa: b.eggPFaixa,
      tickerACount: 0,
      tickerBCount: 0,
      melhorParTickerA: false,
      melhorParTickerB: false,
    };
  });

  // Ativos repetidos: conta ocorrências de cada ticker no ranking e acha o
  // par de maior score pra cada um (pra destacar qual das N repetições vale
  // mais olhar primeiro).
  const contagem = new Map<string, number>();
  const melhorPorTicker = new Map<string, { par: string; score: number }>();
  for (const l of linhas) {
    for (const t of [l.tickerA, l.tickerB]) {
      contagem.set(t, (contagem.get(t) ?? 0) + 1);
      if (l.score !== null) {
        const atual = melhorPorTicker.get(t);
        if (!atual || l.score > atual.score) melhorPorTicker.set(t, { par: l.par, score: l.score });
      }
    }
  }

  for (const l of linhas) {
    l.tickerACount = contagem.get(l.tickerA) ?? 1;
    l.tickerBCount = contagem.get(l.tickerB) ?? 1;
    l.melhorParTickerA = melhorPorTicker.get(l.tickerA)?.par === l.par;
    l.melhorParTickerB = melhorPorTicker.get(l.tickerB)?.par === l.par;
  }

  linhas.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  return linhas;
}
