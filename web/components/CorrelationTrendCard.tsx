import { StatusPill } from "@/components/StatusPill";
import { colors } from "@/lib/theme";
import { linearTrend } from "@/lib/trend";
import type { ZScoreRow } from "@/lib/pairs-data";

const HORIZONTE_DIAS = 10;

/** Selo compacto (sem card/rótulo próprio) — pensado pra ficar ao lado
 * de um título já existente, não como um bloco separado. */
export function CorrelationTrendBadge({ rows }: { rows: ZScoreRow[] }) {
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
  const seta = trend.direcao === "subindo" ? "↑" : trend.direcao === "caindo" ? "↓" : "→";

  return (
    <StatusPill
      label={`${seta} ${trend.projetado.toFixed(2)} em ${HORIZONTE_DIAS}d`}
      color={cor}
    />
  );
}
