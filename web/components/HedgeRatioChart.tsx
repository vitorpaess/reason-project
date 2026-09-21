"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "@/lib/theme";
import { pickTicks } from "@/lib/chart-utils";
import type { BetaPoint } from "@/lib/mean-reversion";

const MAX_X_TICKS = 8;

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: BetaPoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-[var(--shadow-card)]"
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border }}
    >
      <div className="text-ink-muted">{formatDate(point.data)}</div>
      <div className="mt-0.5 font-semibold tabular-nums" style={{ color: colors.seriesZScore }}>
        beta = {point.beta !== null ? point.beta.toFixed(2) : "—"}
      </div>
    </div>
  );
}

export function HedgeRatioChart({ pontos }: { pontos: BetaPoint[] }) {
  const validos = pontos.filter((p) => p.beta !== null);
  if (validos.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-muted">
        Histórico curto demais pra estimar o hedge ratio.
      </p>
    );
  }

  const valores = validos.map((p) => p.beta as number);
  const bruto = Math.max(Math.abs(Math.min(...valores)), Math.abs(Math.max(...valores)));
  // arredonda a margem pra cima em passos de 0.1, igual ao ZScoreChart —
  // evita que o domínio carregue a precisão de ponto flutuante bruta.
  const limite = Math.max(0.2, Math.ceil((bruto + 0.1) * 10) / 10);

  const xTicks = pickTicks(pontos.map((p) => p.data), MAX_X_TICKS);

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={pontos} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={colors.gridline} />

          <XAxis
            dataKey="data"
            ticks={xTicks}
            tickFormatter={formatDate}
            tick={{ fill: colors.inkMuted, fontSize: 11 }}
            axisLine={{ stroke: colors.baseline }}
            tickLine={false}
          />
          <YAxis
            domain={[-limite, limite]}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fill: colors.inkMuted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />

          <ReferenceLine y={0} stroke={colors.baseline} strokeWidth={1} />

          <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.baseline, strokeWidth: 1 }} />

          <Line
            type="monotone"
            dataKey="beta"
            stroke={colors.seriesZScore}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: colors.seriesZScore, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
