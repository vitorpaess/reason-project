// Teste de paridade entre compute_zscore.py (Python, roda no cron diário e
// grava em pares_status/pares_status_atual — alimenta a tabela principal do
// dashboard) e lib/zscore-calc.ts (TypeScript, recalculado sob demanda pra
// página do par e pro ranking). As duas implementações têm que produzir
// exatamente o mesmo z-score/spread/correlação pro mesmo par na mesma
// data — foi a falta disso que deixou compute_zscore.py preso no modo de
// spread antigo ("normalizado") por 3 commits depois de zscore-calc.ts já
// ter trocado pra "log" (ver ec35989 "Ativa spread em log-preço como
// padrão"), com a tabela principal e a página do par mostrando números
// diferentes pro mesmo par.
//
// Roda os dois lados sobre o MESMO par sintético fixo
// (fixtures/zscore_parity_precos.csv, na raiz do repo — não depende de
// rede/Supabase) e compara, dia a dia: z_score_63d, spread e
// correlacao_movel_63d, com tolerância de ponto flutuante (as duas
// implementações somam em ordens ligeiramente diferentes — Python usa
// pandas.rolling, TS usa um loop manual — então bater bit a bit não é
// realista nem necessário; o que importa é a MESMA fórmula, não o mesmo
// arredondamento).
//
// Uso: npm run check:zscore-parity (roda de dentro de web/)

import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { computeZScoreSeries } from "../lib/zscore-calc";
import type { PricePoint } from "../lib/company-prices";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE = path.join(REPO_ROOT, "fixtures", "zscore_parity_precos.csv");
const PYTHON_SCRIPT = path.join(REPO_ROOT, "scripts", "check_zscore_parity.py");

// Tolerância relativa — cobre a diferença de ordem de operações entre
// pandas.rolling (Python) e o loop manual (TS), não uma divergência real de
// fórmula. Qualquer coisa acima disso é bug, não arredondamento.
const TOLERANCIA_RELATIVA = 1e-6;
const TOLERANCIA_ABSOLUTA = 1e-9;

type LinhaPython = {
  data: string;
  z_score_63d: number | null;
  spread: number | null;
  correlacao_movel_63d: number | null;
  sinal: string;
  direcao: string | null;
};

function pythonExecutable(): string {
  const venvPython = path.join(REPO_ROOT, ".venv", "bin", "python3");
  try {
    readFileSync(venvPython);
    return venvPython;
  } catch {
    return "python3";
  }
}

function carregarFixture(): { par: string; precosA: PricePoint[]; precosB: PricePoint[] } {
  const conteudo = readFileSync(FIXTURE, "utf8").trim();
  const [cabecalho, ...linhas] = conteudo.split("\n");
  const colunas = cabecalho.split(",");
  const idxData = colunas.indexOf("data");
  const idxA = colunas.indexOf("preco_a");
  const idxB = colunas.indexOf("preco_b");

  const precosA: PricePoint[] = [];
  const precosB: PricePoint[] = [];
  for (const linha of linhas) {
    const campos = linha.split(",");
    const data = campos[idxData];
    precosA.push({ data, preco: Number(campos[idxA]) });
    precosB.push({ data, preco: Number(campos[idxB]) });
  }
  // Mesmos tickers sintéticos do lado Python (scripts/check_zscore_parity.py).
  return { par: "ZTSTA/ZTSTB", precosA, precosB };
}

function rodarPython(): { par: string; linhas: LinhaPython[] } {
  const saida = execFileSync(pythonExecutable(), [PYTHON_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return JSON.parse(saida);
}

function proximo(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  const diff = Math.abs(a - b);
  return diff <= TOLERANCIA_ABSOLUTA || diff <= TOLERANCIA_RELATIVA * Math.max(Math.abs(a), Math.abs(b));
}

function main() {
  console.log("Carregando fixture sintética compartilhada...");
  const { precosA, precosB } = carregarFixture();

  console.log("Calculando lado TypeScript (lib/zscore-calc.ts, modo log)...");
  const rowsTs = computeZScoreSeries(precosA, precosB, "log");
  const porDataTs = new Map(rowsTs.map((r) => [r.data, r]));

  console.log("Calculando lado Python (compute_zscore.py, _compute_signals)...");
  const { par, linhas: linhasPy } = rodarPython();

  const divergencias: string[] = [];
  let comparadas = 0;

  for (const linhaPy of linhasPy) {
    const linhaTs = porDataTs.get(linhaPy.data);
    if (!linhaTs) {
      divergencias.push(`${linhaPy.data}: data ausente do lado TS`);
      continue;
    }
    comparadas++;

    const campos: [string, number | null, number | null][] = [
      ["z_score_63d", linhaPy.z_score_63d, linhaTs.z_score_63d],
      ["spread", linhaPy.spread, linhaTs.spread],
      ["correlacao_movel_63d", linhaPy.correlacao_movel_63d, linhaTs.correlacao_movel_63d],
    ];

    for (const [nome, py, ts] of campos) {
      if (!proximo(py, ts)) {
        divergencias.push(
          `${linhaPy.data} ${nome}: python=${py} ts=${ts} (diff=${py !== null && ts !== null ? Math.abs(py - ts) : "N/A"})`
        );
      }
    }
  }

  console.log(`\nPar: ${par}`);
  console.log(`Linhas comparadas: ${comparadas}/${linhasPy.length}`);

  if (divergencias.length > 0) {
    console.error(`\nFALHOU: ${divergencias.length} divergência(s) encontrada(s):\n`);
    for (const d of divergencias.slice(0, 30)) console.error(`  - ${d}`);
    if (divergencias.length > 30) console.error(`  ... e mais ${divergencias.length - 30}`);
    process.exit(1);
  }

  const ultimaPy = linhasPy[linhasPy.length - 1];
  console.log(
    `\nPASSOU: compute_zscore.py e zscore-calc.ts concordam em todas as ${comparadas} datas ` +
      `(tolerância ${TOLERANCIA_RELATIVA} relativa). Último dia (${ultimaPy.data}): z=${ultimaPy.z_score_63d?.toFixed(6)}.`
  );
}

main();
