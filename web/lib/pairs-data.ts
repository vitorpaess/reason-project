import "server-only";
import { supabase } from "./supabase";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./config";
import { getOpenPosition } from "./positions";

export type ZScoreRow = {
  data: string; // ISO date
  // Cálculo 1 (oficial): janela móvel de 63 dias — decide sinal/direcao,
  // status atual e cards do topo.
  z_score_63d: number | null;
  correlacao_movel_63d: number | null;
  // Cálculo 2 (histórico): janela expansiva, todos os dias desde o
  // início — só para o gráfico principal e a tabela de oportunidades.
  z_score_expansivo: number | null;
  correlacao_expansiva: number | null;
  spread: number | null;
  sinal: "entrada" | "saida" | "nenhum";
  direcao: string | null;
};

export type SignalEvent = {
  dataEntrada: string;
  zEntrada: number;
  direcao: string | null;
  dataSaida: string | null;
  zSaida: number | null;
  diasEmAberto: number;
};

// oportunidade_entrada: |z_63d| > limiar de entrada, sem posição aberta.
// em_operacao: posição aberta, mas |z_63d| ainda não voltou pra zona de saída.
// oportunidade_saida: posição aberta E |z_63d| já voltou pra zona de saída —
//   é diferente de "em_operacao" porque agora é a hora de considerar sair.
// espera: nada disso — sem sinal e sem posição aberta.
export type Estado =
  | "oportunidade_entrada"
  | "oportunidade_saida"
  | "em_operacao"
  | "espera";

export type PairStatus = {
  rows: ZScoreRow[];
  ultimo: ZScoreRow | null; // última linha com z_score_63d válido (cálculo oficial)
  estado: Estado | null; // null = histórico insuficiente pro cálculo oficial (< 63 dias)
  openPosition: SignalEvent | null; // posição confirmada em aberto (define o status atual)
  oportunidades: SignalEvent[]; // TODO cruzamento de limiar já ocorrido (cálculo oficial), mais recente primeiro
  temSerieExpansiva: boolean; // true assim que houver pelo menos 1 z_score_expansivo válido
};

export async function fetchZScoreRows(par: string): Promise<ZScoreRow[]> {
  const { data, error } = await supabase()
    .from("pares_zscore")
    .select(
      "data,z_score_63d,z_score_expansivo,correlacao_movel_63d,correlacao_expansiva,spread,sinal,direcao"
    )
    .eq("par", par)
    .order("data", { ascending: true });

  if (error) {
    throw new Error(`Falha ao ler pares_zscore para ${par}: ${error.message}`);
  }
  return (data ?? []) as ZScoreRow[];
}

/** z-score oficial (63d) mais recente — usado pra validar entrada/saída no servidor. */
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

/**
 * Todas as oportunidades oficiais já ocorridas (todo cruzamento de limiar
 * do z-score 63d, registrado em pares_zscore.sinal pelo compute_zscore.py)
 * — independente de o usuário ter confirmado entrada/saída ou não. Os
 * valores de z mostrados são sempre os do cálculo 63d (o que de fato
 * cruzou o limiar), mesmo que o gráfico plote a série expansiva.
 */
export function buildOpportunityHistory(rows: ZScoreRow[]): SignalEvent[] {
  const eventos = rows.filter((r) => r.sinal === "entrada" || r.sinal === "saida");
  const oportunidades: SignalEvent[] = [];
  let entradaAtual: ZScoreRow | null = null;

  for (const row of eventos) {
    if (row.sinal === "entrada") {
      entradaAtual = row;
    } else if (row.sinal === "saida" && entradaAtual) {
      oportunidades.push({
        dataEntrada: entradaAtual.data,
        zEntrada: entradaAtual.z_score_63d as number,
        direcao: entradaAtual.direcao,
        dataSaida: row.data,
        zSaida: row.z_score_63d,
        diasEmAberto: daysBetween(entradaAtual.data, row.data),
      });
      entradaAtual = null;
    }
  }

  if (entradaAtual) {
    const hoje = new Date().toISOString().slice(0, 10);
    oportunidades.push({
      dataEntrada: entradaAtual.data,
      zEntrada: entradaAtual.z_score_63d as number,
      direcao: entradaAtual.direcao,
      dataSaida: null,
      zSaida: null,
      diasEmAberto: daysBetween(entradaAtual.data, hoje),
    });
  }

  return oportunidades.reverse();
}

export async function getPairStatus(par: string): Promise<PairStatus> {
  const rows = await fetchZScoreRows(par);
  const validas = rows.filter((r) => r.z_score_63d !== null);
  const ultimo = validas.length > 0 ? validas[validas.length - 1] : null;
  const temSerieExpansiva = rows.some((r) => r.z_score_expansivo !== null);

  const manual = await getOpenPosition(par);
  const hoje = new Date().toISOString().slice(0, 10);
  const openPosition: SignalEvent | null = manual
    ? {
        dataEntrada: manual.data_entrada,
        zEntrada: manual.z_entrada,
        direcao: manual.direcao,
        dataSaida: null,
        zSaida: null,
        diasEmAberto: daysBetween(manual.data_entrada, hoje),
      }
    : null;

  const oportunidades = buildOpportunityHistory(rows);

  let estado: Estado | null = null;
  if (ultimo) {
    const z = Math.abs(ultimo.z_score_63d as number);
    if (openPosition) {
      estado = z < EXIT_THRESHOLD ? "oportunidade_saida" : "em_operacao";
    } else {
      estado = z > ENTRY_THRESHOLD ? "oportunidade_entrada" : "espera";
    }
  }

  return { rows, ultimo, estado, openPosition, oportunidades, temSerieExpansiva };
}
