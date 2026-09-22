// Backtest walk-forward do ranking de oportunidades — testa se o score
// (lib/ranking.ts) ordena os pares de um jeito que se traduz em retorno
// realizado melhor, usando SOMENTE dados disponíveis até cada data de
// entrada simulada (sem lookahead).
//
// Roda fora do Next.js (não pode usar lib/supabase.ts, que importa
// "server-only") — busca os dados direto via @supabase/supabase-js, com as
// mesmas credenciais de .env.local, e reaproveita as funções PURAS já
// validadas de lib/mean-reversion.ts, lib/ranking.ts e lib/zscore-calc.ts
// pra todo o cálculo (nada reimplementado por conta própria).
//
// Uso: npx tsx scripts/backtest-ranking.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { computeZScoreSeries } from "../lib/zscore-calc";
import {
  rollingHalfLife,
  rollingBeta,
  computeCUSUM,
  medianaValida,
  diasEntreDatas,
  HALFLIFE_LONG_WINDOW,
  BETA_WINDOW,
} from "../lib/mean-reversion";
import {
  taxaReversaoHistorica,
  Z_SAIDA as SCORE_Z_SAIDA,
  Z_STOP as SCORE_Z_STOP,
  PRAZO_MAX_MULT_MEIA_VIDA,
  K_SHRINK,
  CORR_MIN,
  DIAS_SEM_QUEBRA,
  BETA_VAR_MAX,
  COMISSAO_PCT,
  SLIPPAGE_PCT,
  ALUGUEL_ANUAL_PCT,
} from "../lib/ranking";
import type { ZScoreRow } from "../lib/pairs-data";

// ---- Parâmetros do backtest (configuráveis) ----------------------------
// Limiar de entrada na simulação — quando |z| cruza pra cima disso, uma
// operação nasce. Igual ao ENTRY_THRESHOLD já usado no resto do app.
const Z_ENTRADA = 1.2;
// Saída/stop da SIMULAÇÃO — mantidos iguais aos usados internamente pelo
// score (lib/ranking.ts) por padrão, mas são parâmetros próprios daqui,
// não uma referência direta, então podem divergir se você quiser testar
// sensibilidade.
const Z_SAIDA = 0.5;
const Z_STOP = 3.0;
// Prazo máximo FIXO da simulação, em linhas da série (~dias úteis) — igual
// pra todos os pares, deliberadamente diferente do prazo ADAPTATIVO
// (2× meia-vida mediana) que o score usa internamente só pra estimar
// P_ajustada. Aqui é o horizonte real de saída de uma operação simulada.
const PRAZO_MAX = 60;
// Custos por execução e aluguel anual — mesmos valores (estimados) já
// usados em lib/ranking.ts, declarados aqui de novo por serem parâmetros
// explícitos do backtest.
const COMISSAO = COMISSAO_PCT;
const SLIPPAGE = SLIPPAGE_PCT;
const ALUGUEL_ANUAL = ALUGUEL_ANUAL_PCT;
// --------------------------------------------------------------------------

type PricePoint = { data: string; preco: number };

function supabaseClient() {
  const env = Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, ""), env.SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

type SupabaseClient = ReturnType<typeof supabaseClient>;

async function fetchTodosPares(supabase: SupabaseClient) {
  const pares: { a: string; b: string; label: string; setor: string }[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("pares_config")
      .select("ticker_a,ticker_b,setor")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      pares.push({ a: r.ticker_a, b: r.ticker_b, label: `${r.ticker_a}/${r.ticker_b}`, setor: r.setor });
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return pares;
}

async function fetchPrecos(
  supabase: SupabaseClient,
  tickers: string[]
): Promise<Map<string, PricePoint[]>> {
  const porTicker = new Map<string, PricePoint[]>(tickers.map((t) => [t, []]));
  const PAGE = 1000;
  const { count, error: countError } = await supabase
    .from("precos_diarios")
    .select("*", { count: "exact", head: true })
    .in("ticker", tickers);
  if (countError) throw new Error(countError.message);
  const total = count ?? 0;
  const paginas = Math.ceil(total / PAGE);
  const respostas = await Promise.all(
    Array.from({ length: paginas }, (_, p) =>
      supabase
        .from("precos_diarios")
        .select("ticker,data,preco_fechamento")
        .in("ticker", tickers)
        .order("ticker", { ascending: true })
        .order("data", { ascending: true })
        .range(p * PAGE, p * PAGE + PAGE - 1)
    )
  );
  for (const { data, error } of respostas) {
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      porTicker.get(r.ticker as string)?.push({ data: r.data as string, preco: r.preco_fechamento as number });
    }
  }
  return porTicker;
}

// ---- Score na entrada (sem P_geral ainda) --------------------------------

type ScoreParcial = {
  ganho: number;
  custo: number;
  meiaVidaMediana: number;
  taxa: ReturnType<typeof taxaReversaoHistorica>;
};

/**
 * Score "como o ranking calcularia" mas usando só rows[0..idxEntrada] —
 * mesmas fórmulas de lib/ranking.ts (Ganho, Perda, Custo, taxa de reversão
 * por episódio, filtros), com UMA simplificação documentada: P_geral (a
 * taxa média usada no encolhimento bayesiano) não é recalculada cruzando
 * todos os pares nessa data exata — isso exigiria reavaliar o universo
 * inteiro em cada uma das milhares de datas de entrada, inviável aqui. Em
 * vez disso, P_geral é resolvida depois via um pool GLOBAL expansível (ver
 * construirPoolPGeral), agregando os desfechos de todas as operações do
 * próprio backtest já resolvidas antes da data — também sem lookahead, só
 * uma definição de P_geral um pouco diferente da do ranking ao vivo.
 */
function computeScoreNaEntrada(
  rows: ZScoreRow[],
  idxEntrada: number,
  zEntrada: number,
  meiaVidaMediana: number | null
): { motivos: string[]; parcial: ScoreParcial | null } {
  const motivos: string[] = [];
  const row = rows[idxEntrada];
  const sigma = row.desvio_spread_63d;
  const az = Math.abs(zEntrada);

  const correlacao = row.correlacao_movel_63d;
  if (correlacao === null || Math.abs(correlacao) <= CORR_MIN) {
    motivos.push("Correlação baixa");
  }

  const rowsAteEntrada = rows.slice(0, idxEntrada + 1);
  const cusum = computeCUSUM(rowsAteEntrada);
  if (cusum.ultimaQuebraData !== null) {
    const dias = diasEntreDatas(cusum.ultimaQuebraData, row.data);
    if (dias <= DIAS_SEM_QUEBRA) motivos.push("Quebra estrutural recente");
  }

  const beta = rollingBeta(rowsAteEntrada, BETA_WINDOW);
  let betaAtualIdx = -1;
  for (let i = beta.length - 1; i >= 0; i--) {
    if (beta[i].beta !== null) {
      betaAtualIdx = i;
      break;
    }
  }
  if (betaAtualIdx >= 0) {
    const idxAnterior = betaAtualIdx - BETA_WINDOW;
    const betaAnterior = idxAnterior >= 0 ? beta[idxAnterior].beta : null;
    const betaAtualValor = beta[betaAtualIdx].beta as number;
    if (betaAnterior !== null && betaAnterior !== 0) {
      const variacao = Math.abs(betaAtualValor - betaAnterior) / Math.abs(betaAnterior);
      if (variacao > BETA_VAR_MAX) motivos.push("Hedge ratio instável");
    }
  }

  if (sigma === null || meiaVidaMediana === null) {
    motivos.push("Histórico insuficiente");
    return { motivos, parcial: null };
  }
  if (az >= SCORE_Z_STOP) {
    motivos.push("Z além do stop");
    return { motivos, parcial: null };
  }

  const ganho = (az - SCORE_Z_SAIDA) * sigma;
  const custo = 4 * (COMISSAO_PCT + SLIPPAGE_PCT) + (ALUGUEL_ANUAL_PCT / 252) * meiaVidaMediana;
  const prazoMaxLinhasScore = Math.round(PRAZO_MAX_MULT_MEIA_VIDA * meiaVidaMediana);
  const taxa = taxaReversaoHistorica(rowsAteEntrada, zEntrada, prazoMaxLinhasScore);

  return { motivos, parcial: { ganho, custo, meiaVidaMediana, taxa } };
}

function finalizarScore(zEntrada: number, parcial: ScoreParcial | null, pGeral: number): number | null {
  if (parcial === null) return null;
  const { ganho, custo, meiaVidaMediana, taxa } = parcial;
  const pAjustada = (taxa.sucessos + K_SHRINK * pGeral) / (taxa.n + K_SHRINK);
  const az = Math.abs(zEntrada);
  const perdaZ = taxa.numFalhas >= 3 ? (taxa.perdaMediaZ as number) : SCORE_Z_STOP - az;
  // sigma já embutido em ganho via computeScoreNaEntrada; recupera pra
  // aplicar na mesma escala em perda.
  const sigma = ganho / (az - SCORE_Z_SAIDA);
  const perda = perdaZ * sigma;
  const retornoLiquido = pAjustada * ganho - (1 - pAjustada) * perda - custo;
  return retornoLiquido / meiaVidaMediana;
}

// ---- Extração de operações (estado flat/aberta, sem sobreposição) -------

type Operacao = {
  par: string;
  setor: string;
  idxEntrada: number;
  dataEntrada: string;
  zEntrada: number;
  idxSaida: number;
  dataSaida: string;
  resultado: "sucesso" | "stop" | "prazo";
  diasReais: number;
  retornoBrutoPct: number;
  custoPct: number;
  retornoLiquidoPct: number;
  motivos: string[];
  parcial: ScoreParcial | null;
  score: number | null; // preenchido depois, por finalizarScore
};

/** Extrai as operações não sobrepostas de um par: cada entrada é resolvida
 * (sucesso/stop/prazo) antes de procurar a próxima — "episódios seguidos
 * do mesmo par" nunca geram mais de uma operação simultânea. */
function extrairOperacoes(
  par: string,
  setor: string,
  rows: ZScoreRow[],
  longa: ReturnType<typeof rollingHalfLife>
): Operacao[] {
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
    // não é uma operação resolvida, não entra no backtest.
    if (resultado === null || spreadEntrada === null) {
      i = ultimoIdx + 1;
      continue;
    }

    const spreadSaida = rows[idxSaida].spread as number;
    const sinalOperacao = Math.sign(zEntrada); // >0: vender A/comprar B; <0: comprar A/vender B
    // Retorno bruto direto do movimento real do spread (não recalculado a
    // partir de um z que pode ter sido afetado pela média móvel arrastando
    // atrás do spread) — é o P&L de fato de uma posição $1 comprado / $1
    // vendido, com o spread em log-preço já nessa escala.
    const retornoBrutoPct = sinalOperacao * (spreadEntrada - spreadSaida);
    const diasReais = idxSaida - i;
    const custoPct = 4 * (COMISSAO + SLIPPAGE) + (ALUGUEL_ANUAL / 252) * diasReais;
    const retornoLiquidoPct = retornoBrutoPct - custoPct;

    const meiaVidaNaEntrada = medianaValida(longa.slice(0, i + 1));
    const { motivos, parcial } = computeScoreNaEntrada(rows, i, zEntrada, meiaVidaNaEntrada);

    operacoes.push({
      par,
      setor,
      idxEntrada: i,
      dataEntrada: rows[i].data,
      zEntrada,
      idxSaida,
      dataSaida: rows[idxSaida].data,
      resultado,
      diasReais,
      retornoBrutoPct,
      custoPct,
      retornoLiquidoPct,
      motivos,
      parcial,
      score: null,
    });

    i = idxSaida + 1; // próxima busca só depois da operação atual resolver
  }

  return operacoes;
}

// ---- Pool global expansível de P_geral (sem lookahead) -------------------
// P_geral(D) = taxa de sucesso agrupada de todas as operações (qualquer
// par) já RESOLVIDAS estritamente antes de D — usa o próprio resultado
// realizado das operações do backtest (critério de entrada por limiar, não
// a banda de tolerância interna do score), ordenado por data de saída, com
// soma acumulada pra responder "P_geral até aqui" em O(log n).
function construirPoolPGeral(operacoes: Operacao[]) {
  const resolvidas = [...operacoes].sort(
    (a, b) => new Date(a.dataSaida).getTime() - new Date(b.dataSaida).getTime()
  );
  const datasSaida = resolvidas.map((o) => new Date(o.dataSaida).getTime());
  const sucessosAcumulados: number[] = [];
  let acc = 0;
  for (const o of resolvidas) {
    acc += o.resultado === "sucesso" ? 1 : 0;
    sucessosAcumulados.push(acc);
  }

  return function pGeralAntesDe(dataEntradaIso: string): number {
    const alvo = new Date(dataEntradaIso).getTime();
    let lo = 0;
    let hi = datasSaida.length - 1;
    let ultimoValido = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (datasSaida[mid] < alvo) {
        ultimoValido = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (ultimoValido === -1) return 0.5; // sem histórico ainda: piso neutro
    const n = ultimoValido + 1;
    return sucessosAcumulados[ultimoValido] / n;
  };
}

// ---- Estatísticas por grupo ------------------------------------------

function mediaSimples(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function relatorioGrupo(nome: string, ops: Operacao[]) {
  if (ops.length === 0) {
    console.log(`${nome}: 0 operações`);
    return;
  }
  const n = ops.length;
  const sucessos = ops.filter((o) => o.resultado === "sucesso").length;
  const taxaSucesso = sucessos / n;
  const retornoMedio = mediaSimples(ops.map((o) => o.retornoLiquidoPct));
  const diasMedios = mediaSimples(ops.map((o) => o.diasReais));
  const pior = ops.reduce((p, o) => (o.retornoLiquidoPct < p.retornoLiquidoPct ? o : p));
  console.log(
    `${nome.padEnd(22)} n=${n.toString().padStart(4)}  sucesso=${(taxaSucesso * 100).toFixed(1).padStart(5)}%  ` +
      `retorno_liq_medio=${(retornoMedio * 100).toFixed(2).padStart(7)}%  dias_medios=${diasMedios.toFixed(1).padStart(5)}  ` +
      `pior=${(pior.retornoLiquidoPct * 100).toFixed(1)}% (${pior.par} ${pior.dataEntrada})`
  );
}

function quintis<T>(itens: T[], chave: (t: T) => number): T[][] {
  const ordenado = [...itens].sort((a, b) => chave(b) - chave(a)); // maior primeiro
  const tamanho = Math.ceil(ordenado.length / 5);
  const grupos: T[][] = [];
  for (let g = 0; g < 5; g++) grupos.push(ordenado.slice(g * tamanho, (g + 1) * tamanho));
  return grupos;
}

// ---- Main ----------------------------------------------------------------

async function main() {
  const supabase = supabaseClient();
  console.log("Buscando pares e preços...");
  const pares = await fetchTodosPares(supabase);
  const tickers = Array.from(new Set(pares.flatMap((p) => [p.a, p.b])));
  const precos = await fetchPrecos(supabase, tickers);
  console.log(`${pares.length} pares, ${tickers.length} tickers.`);

  const todasOperacoes: Operacao[] = [];

  for (const p of pares) {
    const rows = computeZScoreSeries(precos.get(p.a) ?? [], precos.get(p.b) ?? [], "log");
    if (rows.length === 0) continue;
    const longa = rollingHalfLife(rows, HALFLIFE_LONG_WINDOW);
    const ops = extrairOperacoes(p.label, p.setor, rows, longa);
    todasOperacoes.push(...ops);
  }

  console.log(`\n${todasOperacoes.length} operações extraídas (todas as entradas resolvidas, sem sobreposição).`);

  const pGeralAntesDe = construirPoolPGeral(todasOperacoes);
  for (const op of todasOperacoes) {
    const pGeral = pGeralAntesDe(op.dataEntrada);
    op.score = finalizarScore(op.zEntrada, op.parcial, pGeral);
  }

  const comFiltroOk = todasOperacoes.filter((o) => o.motivos.length === 0 && o.score !== null);
  const semFiltro = todasOperacoes.filter((o) => o.motivos.length > 0 || o.score === null);
  console.log(
    `Passaram nos filtros e têm score: ${comFiltroOk.length}. Excluídas (filtro/dado insuficiente): ${semFiltro.length}.`
  );

  console.log("\n=== Quintis por SCORE (Grupo 1 = maior score) ===");
  const gruposScore = quintis(comFiltroOk, (o) => o.score as number);
  gruposScore.forEach((g, i) => relatorioGrupo(`Grupo ${i + 1} (score)`, g));

  console.log("\n=== Top 10 (score) vs. resto ===");
  const ordenadoPorScore = [...comFiltroOk].sort((a, b) => (b.score as number) - (a.score as number));
  relatorioGrupo("Top 10 (score)", ordenadoPorScore.slice(0, 10));
  relatorioGrupo("Resto", ordenadoPorScore.slice(10));

  console.log("\n=== Quintis por |z| na entrada (Grupo 1 = maior |z|) ===");
  const gruposZ = quintis(comFiltroOk, (o) => Math.abs(o.zEntrada));
  gruposZ.forEach((g, i) => relatorioGrupo(`Grupo ${i + 1} (|z|)`, g));

  console.log("\n=== Top 10 (|z|) vs. resto ===");
  const ordenadoPorZ = [...comFiltroOk].sort((a, b) => Math.abs(b.zEntrada) - Math.abs(a.zEntrada));
  relatorioGrupo("Top 10 (|z|)", ordenadoPorZ.slice(0, 10));
  relatorioGrupo("Resto", ordenadoPorZ.slice(10));

  const xs = comFiltroOk.map((o) => o.score as number);
  const ys = comFiltroOk.map((o) => o.retornoLiquidoPct);
  const mx = mediaSimples(xs);
  const my = mediaSimples(ys);
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const corrScore = num / Math.sqrt(denX * denY);
  console.log(`\nCorrelação (score, retorno líquido realizado) = ${corrScore.toFixed(3)}`);

  const zs = comFiltroOk.map((o) => Math.abs(o.zEntrada));
  const mz = mediaSimples(zs);
  let numZ = 0;
  let denZ = 0;
  for (let i = 0; i < zs.length; i++) {
    const dz = zs[i] - mz;
    const dy = ys[i] - my;
    numZ += dz * dy;
    denZ += dz * dz;
  }
  const corrZ = numZ / Math.sqrt(denZ * denY);
  console.log(`Correlação (|z| entrada, retorno líquido realizado) = ${corrZ.toFixed(3)}`);

  // ---- Checagens de sanidade -------------------------------------------
  console.log("\n=== Checagem de sanidade: sinal do retorno por desfecho ===");
  for (const desfecho of ["sucesso", "stop", "prazo"] as const) {
    const grupo = comFiltroOk.filter((o) => o.resultado === desfecho);
    if (grupo.length === 0) continue;
    const brutoMedio = mediaSimples(grupo.map((o) => o.retornoBrutoPct));
    const liqMedio = mediaSimples(grupo.map((o) => o.retornoLiquidoPct));
    console.log(
      `${desfecho.padEnd(10)} n=${grupo.length.toString().padStart(4)}  retorno_bruto_medio=${(brutoMedio * 100).toFixed(2).padStart(7)}%  retorno_liq_medio=${(liqMedio * 100).toFixed(2).padStart(7)}%`
    );
  }

  console.log("\n=== Resumo geral (todas as operações com score, n=" + comFiltroOk.length + ") ===");
  const brutoTodos = comFiltroOk.map((o) => o.retornoBrutoPct);
  const liqTodos = comFiltroOk.map((o) => o.retornoLiquidoPct);
  const custoTodos = comFiltroOk.map((o) => o.custoPct);
  const medianaSimples = (vals: number[]) => {
    const o = [...vals].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 === 0 ? (o[m - 1] + o[m]) / 2 : o[m];
  };
  console.log(`retorno bruto médio:   ${(mediaSimples(brutoTodos) * 100).toFixed(2)}%`);
  console.log(`retorno bruto mediano: ${(medianaSimples(brutoTodos) * 100).toFixed(2)}%`);
  console.log(`custo médio:           ${(mediaSimples(custoTodos) * 100).toFixed(2)}%`);
  console.log(`retorno líquido médio:   ${(mediaSimples(liqTodos) * 100).toFixed(2)}%`);
  console.log(`retorno líquido mediano: ${(medianaSimples(liqTodos) * 100).toFixed(2)}%`);
  console.log(
    `taxa de sucesso geral: ${((comFiltroOk.filter((o) => o.resultado === "sucesso").length / comFiltroOk.length) * 100).toFixed(1)}%`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
