import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { colors } from "@/lib/theme";
import { linearTrend } from "@/lib/trend";
import type { ZScoreRow } from "@/lib/pairs-data";

const HORIZONTE_DIAS = 10;

export function CorrelationTrendCard({ rows }: { rows: ZScoreRow[] }) {
  const values = rows
    .filter((r) => r.correlacao_movel_63d !== null)
    .map((r) => r.correlacao_movel_63d as number);
  const trend = linearTrend(values, HORIZONTE_DIAS);

  if (!trend) return null;

  const cor =
    trend.direcao === "subindo"
      ? colors.statusGood
      : trend.direcao === "caindo"
        ? colors.statusCritical
        : colors.inkMuted;
  const rotulo =
    trend.direcao === "subindo" ? "Subindo" : trend.direcao === "caindo" ? "Caindo" : "Estável";
  const seta = trend.direcao === "subindo" ? "↑" : trend.direcao === "caindo" ? "↓" : "→";

  return (
    <StatCard
      label="Tendência da correlação"
      detail={
        <>
          Projeção simples (reta ajustada ao período visível) pra daqui a {HORIZONTE_DIAS} dias
          úteis — correlação tende a reverter à média, não é uma previsão robusta.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill label={`${seta} ${rotulo}`} color={cor} />
        <span className="text-sm text-ink-secondary">
          esperado:{" "}
          <span className="font-semibold tabular-nums text-ink-primary">
            {trend.projetado.toFixed(2)}
          </span>
        </span>
      </div>
    </StatCard>
  );
}
