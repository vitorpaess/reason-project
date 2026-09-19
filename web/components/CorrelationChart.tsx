"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "@/lib/theme";
import type { ZScoreRow } from "@/lib/pairs-data";

// Mesmo limiar já usado no aviso "Correlação baixa — par pode estar
// perdendo a relação estatística" no card do topo.
const LIMIAR_SAUDAVEL = 0.5;

type ChartPoint = { data: string; correlacao: number };

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-[var(--shadow-card)]"
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border }}
    >
      <div className="text-ink-muted">{formatDate(point.data)}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-ink-primary">
        correlação = {point.correlacao.toFixed(2)}
      </div>
    </div>
  );
}

export function CorrelationChart({ rows }: { rows: ZScoreRow[] }) {
  const points: ChartPoint[] = rows
    .filter((r) => r.correlacao_movel_63d !== null)
    .map((r) => ({ data: r.data, correlacao: r.correlacao_movel_63d as number }));

  if (points.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-ink-muted">
        Sem dados de correlação no período selecionado.
      </p>
    );
  }

  const yTicks = [-1, -0.5, 0, 0.5, 1];

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="correlacao-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.seriesZScore} stopOpacity={0.22} />
              <stop offset="100%" stopColor={colors.seriesZScore} stopOpacity={0} />
            </linearGradient>
          </defs>

          <ReferenceArea
            y1={-1}
            y2={LIMIAR_SAUDAVEL}
            fill={colors.statusCritical}
            fillOpacity={0.06}
            strokeWidth={0}
          />

          <CartesianGrid horizontal vertical={false} stroke={colors.gridline} />

          <XAxis
            dataKey="data"
            tickFormatter={formatDate}
            tick={{ fill: colors.inkMuted, fontSize: 11 }}
            axisLine={{ stroke: colors.baseline }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            domain={[-1, 1]}
            ticks={yTicks}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fill: colors.inkMuted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />

          <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.baseline, strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="correlacao"
            stroke={colors.seriesZScore}
            strokeWidth={2}
            fill="url(#correlacao-fill)"
            dot={false}
            activeDot={{ r: 4, fill: colors.seriesZScore, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.statusCritical }} />
        <span>Zona de correlação baixa · abaixo de {LIMIAR_SAUDAVEL.toFixed(2)}</span>
      </div>
    </div>
  );
}
