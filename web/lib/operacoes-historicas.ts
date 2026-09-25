// Extração de operações históricas reais por par (entrada -> sucesso/stop/
// prazo), sem sobreposição — mesma definição de operação usada em
// scripts/backtest-ranking.ts, mas sem o cálculo de score (esta calculadora
// de garantia só precisa do desfecho e do retorno realizado de cada
// operação, não de como ela teria sido ranqueada na época). Módulo puro
// (sem I/O) — busca e cache ficam em lib/garantia-repo.ts.

import type { ZScoreRow } from "./pairs-data";
import {
  BETA_WINDOW,
  computeCUSUM,
  diasEntreDatas,
  rollingBeta,
} from "./mean-reversion";
import { COMISSAO_PCT, SLIPPAGE_PCT, ALUGUEL_ANUAL_PCT, CORR_MIN, DIAS_SEM_QUEBRA, BETA_VAR_MAX } from "./ranking";

// ---- Parâmetros (mesmos valores do backtest, ver scripts/backtest-ranking.ts) --
export const Z_ENTRADA = 1.2;
export const Z_SAIDA = 0.5;
export const Z_STOP = 3.0;
export const PRAZO_MAX = 60; // linhas da série (~dias úteis)
// ---------------------------------------------------------------------------

export type Operacao = {
  par: string;
  setor: string;
  zEntrada: number;
  dataEntrada: string;
  dataSaida: string;
  resultado: "sucesso" | "stop" | "prazo";
  diasReais: number;
  /** % sobre o valor de UMA perna (compra ou venda — são iguais, dólar-
   * neutro) — já descontado custo de execução/aluguel. Multiplique pelo
   * tamanho em R$ de uma perna pra obter o P&L em dinheiro dessa operação. */
  retornoLiquidoPct: number;
  /** Filtros de qualidade do ranking (correlação/quebra estrutural/hedge
   * ratio — ver lib/ranking.ts) reavaliados NO DIA DA ENTRADA, usando só
   * histórico até ali. Vazio = teria passado no ranking naquele momento.
   * Sem isso, a calculadora de garantia contaria cruzamentos de z de pares
   * que o próprio ranking já reprova — taxa de sucesso bem pior e nada
   * comparável ao resto do app. */
  motivos: string[];
};

function betaVariacaoMotivo(rowsAteEntrada: ZScoreRow[]): string | null {
  const beta = rollingBeta(rowsAteEntrada, BETA_WINDOW);
  let idxAtual = -1;
  for (let i = beta.length - 1; i >= 0; i--) {
    if (beta[i].beta !== null) {
      idxAtual = i;
      break;
    }
  }
  if (idxAtual < 0) return null;

  const idxAnterior = idxAtual - BETA_WINDOW;
  const betaAnterior = idxAnterior >= 0 ? beta[idxAnterior].beta : null;
  const betaAtual = beta[idxAtual].beta as number;
  if (betaAnterior === null || betaAnterior === 0) return null;

  const variacao = Math.abs(betaAtual - betaAnterior) / Math.abs(betaAnterior);
  return variacao > BETA_VAR_MAX ? "Hedge ratio instável" : null;
}

/** Mesmos filtros de qualidade usados no ranking (lib/ranking.ts,
 * computeMetricasBrutas) — reimplementados aqui em vez de importados
 * porque lá eles são calculados junto com o score/taxa de reversão (que
 * esta calculadora não precisa) sobre o histórico INTEIRO; aqui precisam
 * rodar sobre o histórico TRUNCADO até o dia de cada entrada passada, pra
 * não usar dado futuro. */
function motivosNaEntrada(rows: ZScoreRow[], idxEntrada: number): string[] {
  const motivos: string[] = [];
  const row = rows[idxEntrada];
  const rowsAteEntrada = rows.slice(0, idxEntrada + 1);

  const correlacao = row.correlacao_movel_63d;
  if (correlacao === null || Math.abs(correlacao) <= CORR_MIN) {
    motivos.push("Correlação baixa");
  }

  const cusum = computeCUSUM(rowsAteEntrada);
  if (cusum.ultimaQuebraData !== null) {
    const dias = diasEntreDatas(cusum.ultimaQuebraData, row.data);
    if (dias <= DIAS_SEM_QUEBRA) motivos.push("Quebra estrutural recente");
  }

  const motivoBeta = betaVariacaoMotivo(rowsAteEntrada);
  if (motivoBeta) motivos.push(motivoBeta);

  return motivos;
}

/** Extrai as operações não sobrepostas de um par: cada entrada é resolvida
 * (sucesso/stop/prazo) antes de procurar a próxima — "episódios seguidos
 * do mesmo par" nunca geram mais de uma operação simultânea. */
export function extrairOperacoes(par: string, setor: string, rows: ZScoreRow[]): Operacao[] {
  const operacoes: Operacao[] = [];
  const ultimoIdx = rows.length - 1;
  let i = 0;

  while (i <= ultimoIdx) {
    const z = rows[i].z_score_63d;
    if (z === null || Math.abs(z) < Z_ENTRADA) {
      i++;
      continue;
    }

    const zEntrada = z;
    const spreadEntrada = rows[i].spread;
    const fimJanela = i + PRAZO_MAX;
    const fimObservavel = Math.min(fimJanela, ultimoIdx);

    let resultado: Operacao["resultado"] | null = null;
    let idxSaida = -1;

    for (let j = i; j <= fimObservavel; j++) {
      const zj = rows[j].z_score_63d;
      if (zj === null) continue;
      const azj = Math.abs(zj);
      if (azj < Z_SAIDA) {
        resultado = "sucesso";
        idxSaida = j;
        break;
      }
      if (azj >= Z_STOP) {
        resultado = "stop";
        idxSaida = j;
        break;
      }
      if (j === fimJanela) {
        resultado = "prazo";
        idxSaida = j;
        break;
      }
    }

    // Censurada (série acaba antes do prazo terminar, sem sucesso/stop) —
    // não é uma operação resolvida.
    if (resultado === null || spreadEntrada === null) {
      i = ultimoIdx + 1;
      continue;
    }

    const spreadSaida = rows[idxSaida].spread as number;
    const sinalOperacao = Math.sign(zEntrada); // >0: vender A/comprar B; <0: comprar A/vender B
    const retornoBrutoPct = sinalOperacao * (spreadEntrada - spreadSaida);
    const diasReais = idxSaida - i;
    const custoPct = 4 * (COMISSAO_PCT + SLIPPAGE_PCT) + (ALUGUEL_ANUAL_PCT / 252) * diasReais;

    operacoes.push({
      par,
      setor,
      zEntrada,
      dataEntrada: rows[i].data,
      dataSaida: rows[idxSaida].data,
      resultado,
      diasReais,
      retornoLiquidoPct: retornoBrutoPct - custoPct,
      motivos: motivosNaEntrada(rows, i),
    });

    i = idxSaida + 1; // próxima busca só depois da operação atual resolver
  }

  return operacoes;
}
