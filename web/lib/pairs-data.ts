import "server-only";
import { supabase } from "./supabase";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./config";
import { getOpenPosition } from "./positions";

export type ZScoreRow = {
  data: string; // ISO date
  // Cálculo 1 (oficial): janela móvel de 63 dias — decide status atual e
  // cards do topo. buildOpportunityHistory recalcula sinal/direção a
  // partir daqui (e do expansivo, como fallback), em vez de ler colunas
  // sinal/direcao já computadas pelo Python — assim o histórico cobre o
  // período anterior aos 63 dias também (ver buildOpportunityHistory).
  z_score_63d: number | null;
  correlacao_movel_63d: number | null;
  // Cálculo 2 (histórico): janela expansiva, todos os dias desde o
  // início — só para o gráfico principal e a tabela de oportunidades.
  z_score_expansivo: number | null;
  correlacao_expansiva: number | null;
  spread: number | null;
};

export type SignalEvent = {
  dataEntrada: string;
  zEntrada: number;
  direcao: string | null;
  dataSaida: string | null;
  zSaida: number | null;
  diasEmAberto: number;
  /** true se entrada ou saída caem no período anterior aos 63 dias
   * oficiais, onde só existe o z-score expansivo (estimativa, não o
   * cálculo que de fato dispararia um sinal oficial). */
  estimada: boolean;
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
    .select("data,z_score_63d,z_score_expansivo,correlacao_movel_63d,correlacao_expansiva,spread")
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

function direcaoParaZ(par: string, z: number): string {
  const [a, b] = par.split("/");
  return z > 0 ? `vender ${a} / comprar ${b}` : `comprar ${a} / vender ${b}`;
}

/**
 * Todas as oportunidades já ocorridas, cobrindo o histórico inteiro — não
 * só o período com os 63 dias oficiais completos. Pra cada dia, usa o
 * z-score 63d quando existe (cálculo oficial, o mesmo que decide sinal
 * real); nos dias anteriores a isso (primeiros ~62 dias de dado), cai
 * pro z-score expansivo, já que é a única série disponível ali — sem
 * esse fallback, qualquer oportunidade que só apareceu antes dos 63 dias
 * ficaria invisível no histórico mesmo estando visível no gráfico.
 * Marca essas como "estimada" pra não parecerem sinais oficiais.
 */
export function buildOpportunityHistory(par: string, rows: ZScoreRow[]): SignalEvent[] {
  const oportunidades: SignalEvent[] = [];
  let state: "flat" | "aberta" = "flat";
  let entradaAtual: { data: string; z: number; estimada: boolean } | null = null;

  for (const row of rows) {
    const oficial = row.z_score_63d !== null;
    const z = row.z_score_63d ?? row.z_score_expansivo;
    if (z === null) continue;
    const az = Math.abs(z);

    if (state === "flat" && az > ENTRY_THRESHOLD) {
      state = "aberta";
      entradaAtual = { data: row.data, z, estimada: !oficial };
    } else if (state === "aberta" && az < EXIT_THRESHOLD && entradaAtual) {
      oportunidades.push({
        dataEntrada: entradaAtual.data,
        zEntrada: entradaAtual.z,
        direcao: direcaoParaZ(par, entradaAtual.z),
        dataSaida: row.data,
        zSaida: z,
        diasEmAberto: daysBetween(entradaAtual.data, row.data),
        estimada: entradaAtual.estimada || !oficial,
      });
      state = "flat";
      entradaAtual = null;
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
      diasEmAberto: daysBetween(entradaAtual.data, hoje),
      estimada: entradaAtual.estimada,
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
        estimada: false,
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

  return { rows, ultimo, estado, openPosition, oportunidades, temSerieExpansiva };
}
