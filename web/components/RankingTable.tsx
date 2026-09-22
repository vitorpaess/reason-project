import Link from "next/link";
import { colors } from "@/lib/theme";
import { formatPct } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import type { RankingRow } from "@/lib/ranking";
import type { PFaixa } from "@/lib/mean-reversion";

const COLUNAS: { header: string; className: string; tooltip: string }[] = [
  { header: "Par", className: "text-left", tooltip: "Ticker A / Ticker B · setor" },
  { header: "Z atual", className: "text-right", tooltip: "z-score de 63 dias mais recente" },
  {
    header: "Ganho/dia",
    className: "text-right",
    tooltip: "(|z| atual − z_saida) × σ_spread ÷ meia-vida mediana do par",
  },
  {
    header: "Taxa de reversão",
    className: "text-right",
    tooltip:
      "Episódio = 1ª entrada de |z| na faixa ±tolerância_z do z atual (mesmo sinal), com o z como era calculado na época. Sucesso: |z| < z_saída antes de |z| ≥ z_stop e dentro do prazo_max. Falha: stop tocado primeiro ou prazo esgotado (empate no mesmo dia = falha). P_ajustada = (sucessos + k_shrink × P_geral) ÷ (n + k_shrink); P_geral é a taxa média (agrupada) de todos os pares",
  },
  {
    header: "Custo",
    className: "text-right",
    tooltip:
      "4 execuções × (comissão + slippage) + aluguel anual da ponta vendida ÷ 252 × dias esperados de posição",
  },
  {
    header: "Score",
    className: "text-right",
    tooltip:
      "[P_ajustada × Ganho − (1 − P_ajustada) × Perda − Custo] ÷ dias esperados (meia-vida mediana) — pode ser negativo. Perda = média de (|z| saída − |z| entrada) das falhas deste par em σ_spread atual (se ≥3 falhas; senão z_stop − |z| atual), também pode ser negativa",
  },
  {
    header: "ADF",
    className: "text-center",
    tooltip:
      "Teste de raiz unitária (ADF) sobre os últimos 200 dias do spread — não é usado como filtro, só indicativo de estacionariedade recente. Verde: p<0,05. Amarelo: p<0,10. Cinza: p≥0,10 ou dado insuficiente",
  },
  {
    header: "E-G",
    className: "text-center",
    tooltip:
      "Cointegração de Engle-Granger (ln preço A ~ ln preço B, sem impor 1:1) sobre os últimos 200 dias — não é usado como filtro, só indicativo. Verde: p<0,05. Amarelo: p<0,10. Cinza: p≥0,10 ou dado insuficiente",
  },
];

function pFaixaCor(pFaixa: PFaixa | null): string {
  if (pFaixa === "< 0.01" || pFaixa === "< 0.05") return colors.statusGood;
  if (pFaixa === "< 0.10") return colors.statusWarning;
  return colors.inkMuted;
}

function TickerComBadge({
  ticker,
  count,
  melhorPar,
}: {
  ticker: string;
  count: number;
  melhorPar: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {melhorPar && (
        <span style={{ color: colors.statusGood }} title="Maior score entre os pares com este ticker">
          ★
        </span>
      )}
      {ticker}
      {count > 1 && (
        <span className="text-[10px] text-ink-muted" title={`Aparece em ${count} pares deste ranking`}>
          ×{count}
        </span>
      )}
    </span>
  );
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">Sem pares suficientes pra ranquear.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border-strong text-[10px] uppercase tracking-wide text-ink-muted">
            {COLUNAS.map((c) => (
              <th key={c.header} title={c.tooltip} className={`cursor-help px-2 py-2 font-medium ${c.className}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.par}
              className={`border-b border-border transition-opacity ${r.cinza ? "opacity-45" : ""}`}
              title={r.motivos.length > 0 ? r.motivos.join(" · ") : undefined}
            >
              <td className="px-2 py-2">
                <Link
                  href={`/pair/${r.tickerA}-${r.tickerB}`}
                  className="flex flex-wrap items-baseline gap-x-1 font-medium text-ink-secondary hover:text-ink-primary"
                >
                  <TickerComBadge ticker={r.tickerA} count={r.tickerACount} melhorPar={r.melhorParTickerA} />
                  <span className="text-ink-muted">/</span>
                  <TickerComBadge ticker={r.tickerB} count={r.tickerBCount} melhorPar={r.melhorParTickerB} />
                </Link>
                <div className="text-[10px] text-ink-muted">{r.setor}</div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-secondary">
                {r.zAtual !== null ? r.zAtual.toFixed(2) : "—"}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-secondary">
                {formatPct(r.ganhoPorDia, 2)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-secondary">
                {formatPct(r.taxaReversao.pAjustada, 0)}{" "}
                <span className="text-ink-muted">(n={r.taxaReversao.n})</span>
                {r.taxaReversao.amostraInsuficiente && (
                  <div className="text-[10px] text-ink-muted">amostra insuficiente</div>
                )}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-secondary">
                {formatPct(r.custoEstimado, 2)}
              </td>
              <td
                className="px-2 py-2 text-right font-semibold tabular-nums"
                style={{
                  color:
                    r.score === null
                      ? colors.inkMuted
                      : r.score >= 0
                        ? colors.statusGood
                        : colors.statusCritical,
                }}
              >
                {formatPct(r.score, 3)}
              </td>
              <td className="px-2 py-2 text-center">
                <StatusPill label={r.adfPFaixa ?? "N/D"} color={pFaixaCor(r.adfPFaixa)} />
              </td>
              <td className="px-2 py-2 text-center">
                <StatusPill label={r.eggPFaixa ?? "N/D"} color={pFaixaCor(r.eggPFaixa)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
