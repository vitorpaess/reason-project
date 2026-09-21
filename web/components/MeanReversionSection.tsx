"use client";

import { useState } from "react";
import { colors } from "@/lib/theme";
import { EXIT_THRESHOLD } from "@/lib/config";
import { rangeStartDate, type RangeKey } from "@/lib/date-ranges";
import { StatusPill } from "@/components/StatusPill";
import { HalfLifeChart } from "@/components/HalfLifeChart";
import { HedgeRatioChart } from "@/components/HedgeRatioChart";
import { PeriodFilter } from "@/components/PeriodFilter";
import type { ZScoreRow } from "@/lib/pairs-data";
import {
  BETA_WINDOW,
  CORRELACAO_MINIMA_SAUDAVEL,
  HALFLIFE_ALERT_RATIO,
  HALFLIFE_LONG_WINDOW,
  HALFLIFE_SHORT_WINDOW,
  POSICAO_RATIO_AMARELO,
  POSICAO_RATIO_VERMELHO,
  adfTest,
  compararBetaAoRedorDaQuebra,
  computeCUSUM,
  diasForaDoEquilibrio,
  medianaValida,
  rollingBeta,
  rollingHalfLife,
  type HalfLifePoint,
} from "@/lib/mean-reversion";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ultimoValido(pontos: HalfLifePoint[]): HalfLifePoint | null {
  for (let i = pontos.length - 1; i >= 0; i--) {
    if (pontos[i].meiaVida !== null || pontos[i].semReversao) return pontos[i];
  }
  return null;
}

export function MeanReversionSection({
  rows,
}: {
  /** Histórico completo (não filtrado pelo seletor de período do gráfico de
   * z-score) — os cálculos aqui dentro são leituras de "regime atual" e
   * ficam mais confiáveis com o máximo de histórico disponível. Esta seção
   * tem seu próprio seletor de período, que afeta só a janela exibida nos
   * gráficos, não os cálculos em si (ver comentário mais abaixo). */
  rows: ZScoreRow[];
}) {
  const curta = rollingHalfLife(rows, HALFLIFE_SHORT_WINDOW);
  const longa = rollingHalfLife(rows, HALFLIFE_LONG_WINDOW);
  const cusum = computeCUSUM(rows);
  const beta = rollingBeta(rows, BETA_WINDOW);
  const adf = adfTest(rows);

  // Período afeta só a janela exibida nos gráficos abaixo — os cálculos em
  // si (meia-vida, CUSUM, beta, ADF) sempre rodam sobre o histórico
  // completo em `rows`, porque dependem de janelas móveis longas (até 200d)
  // que ficariam incompletas ou distorcidas se recalculadas só dentro do
  // período selecionado.
  const [range, setRange] = useState<RangeKey>("TUDO");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dataMin = rows.length > 0 ? rows[0].data : null;
  const dataMax = rows.length > 0 ? rows[rows.length - 1].data : null;
  const periodoStart =
    range === "CUSTOM" ? customStart || dataMin : dataMax ? rangeStartDate(range, dataMax) : null;
  const periodoEnd = range === "CUSTOM" ? customEnd || dataMax : null;

  const dentroDoPeriodo = (data: string) =>
    (!periodoStart || data >= periodoStart) && (!periodoEnd || data <= periodoEnd);

  const curtaExibida = curta.filter((p) => dentroDoPeriodo(p.data));
  const longaExibida = longa.filter((p) => dentroDoPeriodo(p.data));
  const betaExibido = beta.filter((p) => dentroDoPeriodo(p.data));

  const ultimaCurta = ultimoValido(curta);
  const ultimaLonga = ultimoValido(longa);

  let alertaMeiaVida: string | null = null;
  if (ultimaCurta?.semReversao) {
    alertaMeiaVida = "Sem reversão (curto prazo)";
  } else if (ultimaCurta?.meiaVida != null && ultimaLonga?.meiaVida != null) {
    if (ultimaCurta.meiaVida > HALFLIFE_ALERT_RATIO * ultimaLonga.meiaVida) {
      alertaMeiaVida = `Meia-vida curta > ${HALFLIFE_ALERT_RATIO}× longa`;
    }
  }

  const ultimaCorrelacao =
    rows.length > 0 ? rows[rows.length - 1].correlacao_movel_63d : null;
  const correlacaoOk =
    ultimaCorrelacao !== null && Math.abs(ultimaCorrelacao) > CORRELACAO_MINIMA_SAUDAVEL;
  const correlacaoLabel =
    ultimaCorrelacao !== null ? `Correlação ${ultimaCorrelacao.toFixed(2)}` : "Correlação N/D";

  // Contagem direta sobre o z-score (não via o histórico de oportunidades,
  // que fecha no limiar de ENTRADA e esconderia excursões longas com um
  // mergulho breve no meio — ver lib/mean-reversion.ts).
  const diasForaEquilibrio = diasForaDoEquilibrio(rows, EXIT_THRESHOLD);
  const medianaLonga = medianaValida(longa);
  const razaoPosicao =
    diasForaEquilibrio !== null && medianaLonga !== null && medianaLonga > 0
      ? diasForaEquilibrio / medianaLonga
      : null;
  const corRazao =
    razaoPosicao === null
      ? colors.inkMuted
      : razaoPosicao < POSICAO_RATIO_AMARELO
        ? colors.statusGood
        : razaoPosicao < POSICAO_RATIO_VERMELHO
          ? colors.statusWarning
          : colors.statusCritical;

  const betaComparacao =
    cusum.ultimaQuebraIdx !== null
      ? compararBetaAoRedorDaQuebra(rows, cusum.ultimaQuebraIdx, BETA_WINDOW)
      : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-secondary">Reversão à média do spread</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill label={correlacaoLabel} color={correlacaoOk ? colors.statusGood : colors.inkMuted} />
          {adf && (
            <StatusPill
              label={`ADF p ${adf.pFaixa}`}
              color={adf.estacionario ? colors.statusGood : colors.inkMuted}
            />
          )}
          {cusum.quebraRecenteData && (
            <StatusPill
              label={`Quebra recente · ${formatDate(cusum.quebraRecenteData)}`}
              color={colors.statusCritical}
            />
          )}
          {alertaMeiaVida && <StatusPill label={alertaMeiaVida} color={colors.statusWarning} />}
        </div>
      </div>

      <PeriodFilter
        range={range}
        onRangeChange={setRange}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        dataMin={dataMin}
        dataMax={dataMax}
      />

      <HalfLifeChart curta={curtaExibida} longa={longaExibida} />
      <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
        A meia-vida mede reversão em torno da média local de cada janela, não da média histórica
        do z-score — um patamar novo que já domina boa parte da janela pode parecer &ldquo;revertendo
        rápido&rdquo; mesmo com o z-score longe de zero. Use o selo de quebra (CUSUM) e o indicador
        abaixo como leituras complementares, não como confirmação da meia-vida.
      </p>

      <div className="mt-4 rounded-lg bg-surface-raised px-3.5 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Tempo fora do equilíbrio ÷ meia-vida histórica
        </div>
        {razaoPosicao !== null ? (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums" style={{ color: corRazao }}>
              {razaoPosicao.toFixed(2)}×
            </span>
            <span className="text-xs text-ink-secondary">
              {diasForaEquilibrio}d com |z| ≥ {EXIT_THRESHOLD.toFixed(2)} ÷ mediana de{" "}
              {medianaLonga!.toFixed(0)}d (janela longa)
            </span>
          </div>
        ) : (
          <div className="mt-1 text-xs text-ink-muted">
            {diasForaEquilibrio === null
              ? "Sem z-score calculado ainda."
              : "Histórico insuficiente pra estimar a mediana da meia-vida."}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Estabilidade do hedge ratio (beta móvel, {BETA_WINDOW}d)
        </h3>
        <HedgeRatioChart pontos={betaExibido} />

        {betaComparacao && (betaComparacao.betaAntes !== null || betaComparacao.betaDepois !== null) && (
          <div className="mt-3 rounded-lg bg-surface-raised px-3.5 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Beta antes vs. depois da última quebra ({formatDate(cusum.ultimaQuebraData as string)})
            </div>
            <div className="mt-1 flex items-baseline gap-2 text-xs text-ink-secondary">
              <span className="tabular-nums text-ink-primary">
                {betaComparacao.betaAntes !== null ? betaComparacao.betaAntes.toFixed(2) : "—"}
              </span>
              <span>→</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: betaComparacao.mudancaRelevante ? colors.statusWarning : colors.statusGood }}
              >
                {betaComparacao.betaDepois !== null ? betaComparacao.betaDepois.toFixed(2) : "—"}
              </span>
              <span className="text-ink-muted">
                {betaComparacao.mudancaRelevante
                  ? "— mudança relevante, considere reestimar os parâmetros"
                  : "— hedge ratio estável, quebra provavelmente é só deslocamento de nível"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
