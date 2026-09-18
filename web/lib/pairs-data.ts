import "server-only";
import { supabase } from "./supabase";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./config";
import { getPositionHistory } from "./positions";

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
  openPosition: SignalEvent | null;
  historico: SignalEvent[]; // posições confirmadas (abertas e fechadas), mais recente primeiro
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

export async function getPairStatus(par: string): Promise<PairStatus> {
  const rows = await fetchZScoreRows(par);
  const validas = rows.filter((r) => r.z_score !== null);
  const ultimo = validas.length > 0 ? validas[validas.length - 1] : null;

  const historico = await getPositionHistory(par);
  const openPosition = historico.find((e) => e.dataSaida === null) ?? null;

  let estado: Estado | null = null;
  if (ultimo) {
    const z = Math.abs(ultimo.z_score as number);
    if (openPosition) {
      estado = z < EXIT_THRESHOLD ? "oportunidade_saida" : "em_operacao";
    } else {
      estado = z > ENTRY_THRESHOLD ? "oportunidade_entrada" : "espera";
    }
  }

  return { rows, ultimo, estado, openPosition, historico };
}
