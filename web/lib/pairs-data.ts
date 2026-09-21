import "server-only";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./config";
import { getOpenPosition } from "./positions";
import { fetchCompanyPriceSeries } from "./company-prices";
import { computeZScoreSeries } from "./zscore-calc";

export type ZScoreRow = {
  data: string; // ISO date
  // Janela móvel de 63 dias — única série do sistema. Decide status
  // atual, cards do topo, gráfico e histórico de oportunidades.
  z_score_63d: number | null;
  correlacao_movel_63d: number | null;
  spread: number | null;
  // Retorno diário (pct_change) de cada ticker — já calculado internamente
  // pra correlação/spread, exposto aqui pra lib/mean-reversion.ts (beta
  // móvel, ADF) não precisar refazer o alinhamento de datas dos preços.
  retorno_a: number | null;
  retorno_b: number | null;
};

export type SignalEvent = {
  dataEntrada: string;
  /** Valor de z realmente observado no fechamento do dia de entrada
   * (não um limiar padrão) — pode passar um pouco de 1.20/-1.20, já que
   * só temos 1 preço por dia e o cruzamento real acontece entre dois
   * fechamentos. */
  zEntrada: number;
  direcao: string | null;
  dataSaida: string | null;
  /** Valor de z realmente observado no fechamento do dia de saída. */
  zSaida: number | null;
  /** Valor de z mais extremo (com sinal) observado durante a oportunidade. */
  pico: number;
  diasEmAberto: number;
};

// oportunidade_entrada: |z| > limiar de entrada, sem posição aberta.
// em_operacao: posição aberta, mas |z| ainda não voltou pra zona de saída.
// oportunidade_saida: posição aberta E |z| já voltou pra zona de saída —
//   é diferente de "em_operacao" porque agora é a hora de considerar sair.
// espera: nada disso — sem sinal e sem posição aberta.
export type Estado =
  | "oportunidade_entrada"
  | "oportunidade_saida"
  | "em_operacao"
  | "espera";

export type PairStatus = {
  rows: ZScoreRow[];
  ultimo: ZScoreRow | null; // última linha com z_score_63d válido
  estado: Estado | null; // null = histórico insuficiente (< 63 dias)
  openPosition: SignalEvent | null; // posição confirmada em aberto (define o status atual)
  oportunidades: SignalEvent[]; // todo cruzamento de limiar já ocorrido, mais recente primeiro
};

/** Calcula a série de z-score/correlação sob demanda, a partir do preço
 * bruto dos dois tickers — não lê mais de uma tabela pré-calculada (ver
 * lib/zscore-calc.ts pro porquê). */
export async function fetchZScoreRows(par: string): Promise<ZScoreRow[]> {
  const [tickerA, tickerB] = par.split("/");
  if (!tickerA || !tickerB) return [];

  const [precosA, precosB] = await Promise.all([
    fetchCompanyPriceSeries(tickerA),
    fetchCompanyPriceSeries(tickerB),
  ]);
  return computeZScoreSeries(precosA, precosB);
}

/** z-score mais recente — usado pra validar entrada/saída no servidor. */
export async function getLatestZScore(par: string): Promise<number | null> {
  const rows = await fetchZScoreRows(par);
  const validas = rows.filter((r) => r.z_score_63d !== null);
  if (validas.length === 0) return null;
  return validas[validas.length - 1].z_score_63d;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/** Maior |z| (com sinal) observado desde uma data — usado pra calcular o
 * pico de uma posição confirmada manualmente, que não passa pelo state
 * machine de buildOpportunityHistory. */
function picoDesde(rows: ZScoreRow[], desde: string, valorInicial: number): number {
  let pico = valorInicial;
  for (const row of rows) {
    if (row.data < desde) continue;
    if (row.z_score_63d !== null && Math.abs(row.z_score_63d) > Math.abs(pico)) {
      pico = row.z_score_63d;
    }
  }
  return pico;
}

function direcaoParaZ(par: string, z: number): string {
  const [a, b] = par.split("/");
  return z > 0 ? `vender ${a} / comprar ${b}` : `comprar ${a} / vender ${b}`;
}

/**
 * Todo cruzamento de limiar já ocorrido, usando exclusivamente o z-score
 * de 63 dias — mesma série que decide o status atual e é plotada no
 * gráfico. Entrada/saída usam o dia real de fechamento e o z realmente
 * observado naquele dia (pode passar um pouco do limiar — só temos 1
 * preço por dia).
 */
export function buildOpportunityHistory(par: string, rows: ZScoreRow[]): SignalEvent[] {
  const oportunidades: SignalEvent[] = [];
  let state: "flat" | "aberta" = "flat";
  let entradaAtual: { data: string; z: number; pico: number } | null = null;

  for (const row of rows) {
    const z = row.z_score_63d;
    if (z === null) continue;
    const az = Math.abs(z);

    if (state === "flat" && az > ENTRY_THRESHOLD) {
      state = "aberta";
      entradaAtual = { data: row.data, z, pico: z };
    } else if (state === "aberta" && entradaAtual) {
      if (Math.abs(z) > Math.abs(entradaAtual.pico)) entradaAtual.pico = z;

      if (az < EXIT_THRESHOLD) {
        oportunidades.push({
          dataEntrada: entradaAtual.data,
          zEntrada: entradaAtual.z,
          direcao: direcaoParaZ(par, entradaAtual.z),
          dataSaida: row.data,
          zSaida: z,
          pico: entradaAtual.pico,
          diasEmAberto: daysBetween(entradaAtual.data, row.data),
        });
        state = "flat";
        entradaAtual = null;
      }
    }
  }

  if (entradaAtual) {
    const hoje = new Date().toISOString().slice(0, 10);
    oportunidades.push({
      dataEntrada: entradaAtual.data,
      zEntrada: entradaAtual.z,
      direcao: direcaoParaZ(par, entradaAtual.z),
      dataSaida: null,
      zSaida: null,
      pico: entradaAtual.pico,
      diasEmAberto: daysBetween(entradaAtual.data, hoje),
    });
  }

  return oportunidades.reverse();
}

export async function getPairStatus(par: string): Promise<PairStatus> {
  const rows = await fetchZScoreRows(par);
  const validas = rows.filter((r) => r.z_score_63d !== null);
  const ultimo = validas.length > 0 ? validas[validas.length - 1] : null;

  const manual = await getOpenPosition(par);
  const hoje = new Date().toISOString().slice(0, 10);
  const openPosition: SignalEvent | null = manual
    ? {
        dataEntrada: manual.data_entrada,
        zEntrada: manual.z_entrada,
        direcao: manual.direcao,
        dataSaida: null,
        zSaida: null,
        pico: picoDesde(rows, manual.data_entrada, manual.z_entrada),
        diasEmAberto: daysBetween(manual.data_entrada, hoje),
      }
    : null;

  const oportunidades = buildOpportunityHistory(par, rows);

  let estado: Estado | null = null;
  if (ultimo) {
    const z = Math.abs(ultimo.z_score_63d as number);
    if (openPosition) {
      estado = z < EXIT_THRESHOLD ? "oportunidade_saida" : "em_operacao";
    } else {
      estado = z > ENTRY_THRESHOLD ? "oportunidade_entrada" : "espera";
    }
  }

  return { rows, ultimo, estado, openPosition, oportunidades };
}
