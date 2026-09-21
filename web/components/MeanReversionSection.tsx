import { colors } from "@/lib/theme";
import { StatusPill } from "@/components/StatusPill";
import { HalfLifeChart } from "@/components/HalfLifeChart";
import type { SignalEvent, ZScoreRow } from "@/lib/pairs-data";
import {
  CORRELACAO_MINIMA_SAUDAVEL,
  HALFLIFE_ALERT_RATIO,
  HALFLIFE_LONG_WINDOW,
  HALFLIFE_SHORT_WINDOW,
  POSICAO_RATIO_AMARELO,
  POSICAO_RATIO_VERMELHO,
  computeCUSUM,
  medianaValida,
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
  oportunidades,
}: {
  /** Histórico completo (não filtrado pelo seletor de período) — esses
   * indicadores são leituras de "regime atual" e ficam mais confiáveis
   * com o máximo de histórico disponível, não com uma janela curta que o
   * usuário pode ter selecionado só pra olhar o gráfico de z-score. */
  rows: ZScoreRow[];
  oportunidades: SignalEvent[];
}) {
  const curta = rollingHalfLife(rows, HALFLIFE_SHORT_WINDOW);
  const longa = rollingHalfLife(rows, HALFLIFE_LONG_WINDOW);
  const cusum = computeCUSUM(rows);

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

  // Reaproveita o histórico de oportunidades (state machine já existente
  // sobre o z-score) — se a oportunidade mais recente ainda está aberta,
  // diasEmAberto já É "há quantos dias |z| > limiar desde a última entrada".
  const posicaoAtual = oportunidades[0];
  const diasEmExcursao =
    posicaoAtual && posicaoAtual.dataSaida === null ? posicaoAtual.diasEmAberto : null;
  const medianaLonga = medianaValida(longa);
  const razaoPosicao =
    diasEmExcursao !== null && medianaLonga !== null && medianaLonga > 0
      ? diasEmExcursao / medianaLonga
      : null;
  const corRazao =
    razaoPosicao === null
      ? colors.inkMuted
      : razaoPosicao < POSICAO_RATIO_AMARELO
        ? colors.statusGood
        : razaoPosicao < POSICAO_RATIO_VERMELHO
          ? colors.statusWarning
          : colors.statusCritical;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-secondary">Reversão à média do spread</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill label={correlacaoLabel} color={correlacaoOk ? colors.statusGood : colors.inkMuted} />
          {cusum.quebraData && (
            <StatusPill
              label={`Quebra detectada · ${formatDate(cusum.quebraData)}`}
              color={colors.statusCritical}
            />
          )}
          {alertaMeiaVida && <StatusPill label={alertaMeiaVida} color={colors.statusWarning} />}
        </div>
      </div>

      <HalfLifeChart curta={curta} longa={longa} />

      <div className="mt-4 rounded-lg bg-surface-raised px-3.5 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Tempo em posição ÷ meia-vida histórica
        </div>
        {razaoPosicao !== null ? (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums" style={{ color: corRazao }}>
              {razaoPosicao.toFixed(2)}×
            </span>
            <span className="text-xs text-ink-secondary">
              {diasEmExcursao}d em posição ÷ mediana de {medianaLonga!.toFixed(0)}d (janela longa)
            </span>
          </div>
        ) : (
          <div className="mt-1 text-xs text-ink-muted">
            {diasEmExcursao === null
              ? "Sem oportunidade em aberto no momento."
              : "Histórico insuficiente pra estimar a mediana da meia-vida."}
          </div>
        )}
      </div>
    </div>
  );
}
