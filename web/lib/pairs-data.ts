import "server-only";
import { supabase } from "./supabase";

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

export type Estado = "aberta" | "saida" | "espera";

export type PairStatus = {
  rows: ZScoreRow[];
  ultimo: ZScoreRow | null;
  estado: Estado | null; // null = histórico insuficiente
  historico: SignalEvent[]; // mais recente primeiro
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

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function buildSignalHistory(rows: ZScoreRow[]): SignalEvent[] {
  const eventos = rows.filter((r) => r.sinal === "entrada" || r.sinal === "saida");
  const historico: SignalEvent[] = [];
  let entradaAtual: ZScoreRow | null = null;

  for (const row of eventos) {
    if (row.sinal === "entrada") {
      entradaAtual = row;
    } else if (row.sinal === "saida" && entradaAtual) {
      historico.push({
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
    historico.push({
      dataEntrada: entradaAtual.data,
      zEntrada: entradaAtual.z_score as number,
      direcao: entradaAtual.direcao,
      dataSaida: null,
      zSaida: null,
      diasEmAberto: daysBetween(entradaAtual.data, hoje),
    });
  }

  return historico.reverse();
}

export function computeStatus(rows: ZScoreRow[]): PairStatus {
  const validas = rows.filter((r) => r.z_score !== null);
  if (validas.length === 0) {
    return { rows, ultimo: null, estado: null, historico: [] };
  }

  const ultimo = validas[validas.length - 1];
  const historico = buildSignalHistory(rows);
  const posicaoAberta = historico.length > 0 && historico[0].dataSaida === null;

  let estado: Estado;
  if (posicaoAberta) {
    estado = "aberta";
  } else if (ultimo.sinal === "saida") {
    estado = "saida";
  } else {
    estado = "espera";
  }

  return { rows, ultimo, estado, historico };
}

export async function getPairStatus(par: string): Promise<PairStatus> {
  const rows = await fetchZScoreRows(par);
  return computeStatus(rows);
}
