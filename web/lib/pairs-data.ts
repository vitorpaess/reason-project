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
  /** Momento estimado (interpolado) do cruzamento do limiar, não o dia de
   * fechamento bruto — pode cair num dia diferente do dia de referência. */
  dataEntrada: string;
  /** Hora aproximada (0-23) do cruzamento interpolado; null quando não deu
   * pra interpolar (cai no valor bruto do dia de referência). */
  horaEntrada: number | null;
  /** Dia real de pregão em que o cruzamento foi detectado — usado só para
   * posicionar o marcador no gráfico (sempre um dia com dado real). */
  diaReferenciaEntrada: string;
  /** Valor exato do limiar (1.20/-1.20) quando interpolado; o valor bruto
   * observado quando não deu pra interpolar. */
  zEntrada: number;
  direcao: string | null;
  dataSaida: string | null;
  horaSaida: number | null;
  diaReferenciaSaida: string | null;
  zSaida: number | null;
  /** Valor de z mais extremo (com sinal) observado durante a oportunidade,
   * do fechamento bruto de cada dia (não o limiar interpolado). */
  pico: number;
  /** Fracionário — reflete a interpolação, não é mais um número inteiro de dias. */
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

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fractionalDaysBetween(msA: number, msB: number): number {
  return Math.round(((msB - msA) / (1000 * 60 * 60 * 24)) * 10) / 10;
}

/** Maior |z| (com sinal) observado desde uma data — usado pra calcular o
 * pico de uma posição confirmada manualmente, que não passa pelo state
 * machine de buildOpportunityHistory. */
function picoDesde(rows: ZScoreRow[], desde: string, valorInicial: number): number {
  let pico = valorInicial;
  for (const row of rows) {
    if (row.data < desde) continue;
    const z = row.z_score_63d ?? row.z_score_expansivo;
    if (z !== null && Math.abs(z) > Math.abs(pico)) pico = z;
  }
  return pico;
}

function direcaoParaZ(par: string, z: number): string {
  const [a, b] = par.split("/");
  return z > 0 ? `vender ${a} / comprar ${b}` : `comprar ${a} / vender ${b}`;
}

type Ponto = { data: string; z: number; oficial: boolean };

type Cruzamento = { ms: number; data: string; hora: number | null; z: number; interpolado: boolean };

/**
 * Estima o momento exato (não só o dia) em que o z-score cruzou um limiar,
 * interpolando linearmente entre o ponto anterior e o atual — já que só
 * temos 1 preço de fechamento por dia, não dá pra observar o cruzamento
 * real, só aproximar assumindo variação linear entre os dois fechamentos.
 * Só interpola quando os dois pontos vêm da mesma série (63d ou
 * expansivo); na fronteira dos 63 dias (onde a série muda), ou quando não
 * há ponto anterior, cai pro valor bruto do dia atual sem interpolar.
 */
function interpolarCruzamento(anterior: Ponto | null, atual: Ponto, limiar: number): Cruzamento {
  const msAtual = new Date(atual.data + "T00:00:00").getTime();

  if (!anterior || anterior.oficial !== atual.oficial || anterior.z === atual.z) {
    return { ms: msAtual, data: atual.data, hora: null, z: atual.z, interpolado: false };
  }

  const fracao = Math.min(1, Math.max(0, (limiar - anterior.z) / (atual.z - anterior.z)));
  const msAnterior = new Date(anterior.data + "T00:00:00").getTime();
  const msInterpolado = msAnterior + fracao * (msAtual - msAnterior);
  const momento = new Date(msInterpolado);

  return {
    ms: msInterpolado,
    data: toIsoDateLocal(momento),
    hora: momento.getHours(),
    z: limiar,
    interpolado: true,
  };
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
 *
 * A entrada/saída não é mais "o dia" em que o limiar foi cruzado, e sim o
 * momento estimado do cruzamento (ver interpolarCruzamento).
 */
export function buildOpportunityHistory(par: string, rows: ZScoreRow[]): SignalEvent[] {
  const oportunidades: SignalEvent[] = [];
  let state: "flat" | "aberta" = "flat";
  let entradaAtual:
    | { cruzamento: Cruzamento; diaReferencia: string; estimada: boolean; pico: number }
    | null = null;
  let anterior: Ponto | null = null;

  for (const row of rows) {
    const oficial = row.z_score_63d !== null;
    const z = row.z_score_63d ?? row.z_score_expansivo;
    if (z === null) continue;
    const atual: Ponto = { data: row.data, z, oficial };
    const az = Math.abs(z);

    if (state === "flat" && az > ENTRY_THRESHOLD) {
      const limiar = z > 0 ? ENTRY_THRESHOLD : -ENTRY_THRESHOLD;
      const cruzamento = interpolarCruzamento(anterior, atual, limiar);
      state = "aberta";
      entradaAtual = { cruzamento, diaReferencia: row.data, estimada: !oficial, pico: z };
    } else if (state === "aberta" && entradaAtual) {
      if (Math.abs(z) > Math.abs(entradaAtual.pico)) entradaAtual.pico = z;

      if (az < EXIT_THRESHOLD) {
        const ladoAnterior = anterior ? anterior.z : atual.z;
        const limiar = ladoAnterior > 0 ? EXIT_THRESHOLD : -EXIT_THRESHOLD;
        const cruzamentoSaida = interpolarCruzamento(anterior, atual, limiar);
        oportunidades.push({
          dataEntrada: entradaAtual.cruzamento.data,
          horaEntrada: entradaAtual.cruzamento.hora,
          diaReferenciaEntrada: entradaAtual.diaReferencia,
          zEntrada: entradaAtual.cruzamento.z,
          direcao: direcaoParaZ(par, entradaAtual.cruzamento.z),
          dataSaida: cruzamentoSaida.data,
          horaSaida: cruzamentoSaida.hora,
          diaReferenciaSaida: row.data,
          zSaida: cruzamentoSaida.z,
          pico: entradaAtual.pico,
          diasEmAberto: fractionalDaysBetween(entradaAtual.cruzamento.ms, cruzamentoSaida.ms),
          estimada: entradaAtual.estimada || !oficial,
        });
        state = "flat";
        entradaAtual = null;
      }
    }
    anterior = atual;
  }

  if (entradaAtual) {
    const agora = Date.now();
    oportunidades.push({
      dataEntrada: entradaAtual.cruzamento.data,
      horaEntrada: entradaAtual.cruzamento.hora,
      diaReferenciaEntrada: entradaAtual.diaReferencia,
      zEntrada: entradaAtual.cruzamento.z,
      direcao: direcaoParaZ(par, entradaAtual.cruzamento.z),
      dataSaida: null,
      horaSaida: null,
      diaReferenciaSaida: null,
      zSaida: null,
      pico: entradaAtual.pico,
      diasEmAberto: fractionalDaysBetween(entradaAtual.cruzamento.ms, agora),
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
  const openPosition: SignalEvent | null = manual
    ? {
        dataEntrada: manual.data_entrada,
        horaEntrada: null,
        diaReferenciaEntrada: manual.data_entrada,
        zEntrada: manual.z_entrada,
        direcao: manual.direcao,
        dataSaida: null,
        horaSaida: null,
        diaReferenciaSaida: null,
        zSaida: null,
        pico: picoDesde(rows, manual.data_entrada, manual.z_entrada),
        diasEmAberto: fractionalDaysBetween(
          new Date(manual.data_entrada + "T00:00:00").getTime(),
          Date.now()
        ),
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
