import "server-only";
import { supabase } from "./supabase";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./config";
import { getOpenPosition } from "./positions";

export type ZScoreRow = {
  data: string; // ISO date
  z_score: number | null;
  correlacao_movel_63d: number | null;
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

// oportunidade_entrada: |z| > limiar de entrada, sem posição aberta ainda.
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
  ultimo: ZScoreRow | null;
  estado: Estado | null; // null = histórico insuficiente (sem z-score ainda)
  openPosition: SignalEvent | null; // posição confirmada em aberto (define o status atual)
  oportunidades: SignalEvent[]; // TODO cruzamento de limiar já ocorrido, mais recente primeiro
};

export async function fetchZScoreRows(par: string): Promise<ZScoreRow[]> {
  const { data, error } = await supabase()
    .from("pares_zscore")
    .select("data,z_score,correlacao_movel_63d,spread,sinal,direcao")
    .eq("par", par)
    .order("data", { ascending: true });

  if (error) {
    throw new Error(`Falha ao ler pares_zscore para ${par}: ${error.message}`);
  }
  return (data ?? []) as ZScoreRow[];
}

export async function getLatestZScore(par: string): Promise<number | null> {
  const rows = await fetchZScoreRows(par);
  const validas = rows.filter((r) => r.z_score !== null);
  if (validas.length === 0) return null;
  return validas[validas.length - 1].z_score;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/**
 * Todas as oportunidades matemáticas já ocorridas (todo cruzamento de
 * limiar registrado em pares_zscore.sinal pelo compute_zscore.py) —
 * independente de o usuário ter confirmado entrada/saída ou não.
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
        zEntrada: entradaAtual.z_score as number,
        direcao: entradaAtual.direcao,
        dataSaida: row.data,
        zSaida: row.z_score,
        diasEmAberto: daysBetween(entradaAtual.data, row.data),
      });
      entradaAtual = null;
    }
  }

  if (entradaAtual) {
    const hoje = new Date().toISOString().slice(0, 10);
    oportunidades.push({
      dataEntrada: entradaAtual.data,
      zEntrada: entradaAtual.z_score as number,
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
  const validas = rows.filter((r) => r.z_score !== null);
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
        diasEmAberto: daysBetween(manual.data_entrada, hoje),
      }
    : null;

  const oportunidades = buildOpportunityHistory(rows);

  let estado: Estado | null = null;
  if (ultimo) {
    const z = Math.abs(ultimo.z_score as number);
    if (openPosition) {
      estado = z < EXIT_THRESHOLD ? "oportunidade_saida" : "em_operacao";
    } else {
      estado = z > ENTRY_THRESHOLD ? "oportunidade_entrada" : "espera";
    }
  }

  return { rows, ultimo, estado, openPosition, oportunidades };
}
