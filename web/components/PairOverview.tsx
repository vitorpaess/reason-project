import { ENTRY_THRESHOLD, ROLLING_WINDOW_DAYS, type PairDef } from "@/lib/config";
import { statusColor, statusLabel } from "@/lib/theme";
import { PairIcon } from "@/lib/pair-icons";
import type { PairStatus } from "@/lib/pairs-data";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { PositionControl } from "@/components/PositionControl";
import { ThresholdProgress } from "@/components/ThresholdProgress";
import { PairChartSection } from "@/components/PairChartSection";
import { CompanyPriceSection } from "@/components/CompanyPriceSection";
import { HeartButton } from "@/components/HeartButton";
import { fetchCompanyPriceSeries } from "@/lib/company-prices";
import { isFavorite } from "@/lib/favorites-repo";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export async function PairOverview({
  pairDef,
  status,
}: {
  pairDef: PairDef;
  status: PairStatus;
}) {
  const pronto = status.estado !== null && status.ultimo !== null;
  const [precoA, precoB, favorito] = await Promise.all([
    fetchCompanyPriceSeries(pairDef.a),
    fetchCompanyPriceSeries(pairDef.b),
    isFavorite(pairDef.label),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-center gap-1">
        <PairIcon slug={pairDef.slug} size={10} />
        <h1 className="ml-1.5 text-xl font-semibold text-ink-primary">{pairDef.label}</h1>
        <HeartButton par={pairDef.label} inicial={favorito} />
      </div>

      {pronto && status.ultimo ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Status" detail={<StatusDetail status={status} />}>
              <StatusPill label={statusLabel[status.estado!]} color={statusColor(status.estado!)} />
              {status.estado === "oportunidade_entrada" && (
                <PositionControl par={pairDef.label} action="entrar" />
              )}
              {status.estado === "oportunidade_saida" && (
                <PositionControl par={pairDef.label} action="sair" />
              )}
            </StatCard>

            <StatCard label="Z-score atual">
              <span className="text-xl font-semibold tabular-nums text-ink-primary">
                {status.ultimo.z_score_63d?.toFixed(2)}
              </span>
              <ThresholdProgress z={status.ultimo.z_score_63d as number} estado={status.estado!} />
            </StatCard>

            <StatCard
              label={`Correlação móvel ${ROLLING_WINDOW_DAYS}d`}
              detail={
                status.ultimo.correlacao_movel_63d !== null &&
                Math.abs(status.ultimo.correlacao_movel_63d) < 0.5
                  ? "Correlação baixa — par pode estar perdendo a relação estatística."
                  : undefined
              }
            >
              <span className="text-xl font-semibold tabular-nums text-ink-primary">
                {status.ultimo.correlacao_movel_63d !== null
                  ? status.ultimo.correlacao_movel_63d.toFixed(2)
                  : "N/D"}
              </span>
            </StatCard>
          </div>

          <PairChartSection rows={status.rows} oportunidades={status.oportunidades} />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-secondary">
          Histórico insuficiente ainda para calcular z-score/correlação (janela de{" "}
          {ROLLING_WINDOW_DAYS} dias). Aguarde mais coletas diárias.
        </div>
      )}

      <CompanyPriceSection tickers={[pairDef.a, pairDef.b]} series={[precoA, precoB]} />
    </div>
  );
}

function StatusDetail({ status }: { status: PairStatus }) {
  if (status.estado === "oportunidade_entrada") {
    return <span>|z| passou de {ENTRY_THRESHOLD.toFixed(2)} — confirme se entrou na operação</span>;
  }
  if (status.estado === "em_operacao" && status.openPosition) {
    const e = status.openPosition;
    return (
      <span>
        desde {formatDate(e.dataEntrada)} ({e.diasEmAberto}d) — {e.direcao}
      </span>
    );
  }
  if (status.estado === "oportunidade_saida" && status.openPosition) {
    const e = status.openPosition;
    return (
      <span>
        entrada em {formatDate(e.dataEntrada)} ({e.diasEmAberto}d) — |z| voltou pra zona de saída
      </span>
    );
  }
  return <span>aguardando |z| &gt; {ENTRY_THRESHOLD.toFixed(2)}</span>;
}
