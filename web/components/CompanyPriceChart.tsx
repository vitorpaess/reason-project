"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "@/lib/theme";
import type { PricePoint } from "@/lib/company-prices";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatUsd(v: number): string {
  return `US$ ${v.toFixed(2)}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PricePoint }[];
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
        {formatUsd(point.preco)}
      </div>
    </div>
  );
}

export function CompanyPriceChart({ ticker, points }: { ticker: string; points: PricePoint[] }) {
  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">Sem dados de preço ainda.</p>
    );
  }

  const gradientId = `preco-fill-${ticker}`;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.seriesZScore} stopOpacity={0.22} />
            <stop offset="100%" stopColor={colors.seriesZScore} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid horizontal vertical={false} stroke={colors.gridline} />

        <XAxis
          dataKey="data"
          tickFormatter={formatDate}
          tick={{ fill: colors.inkMuted, fontSize: 11 }}
          axisLine={{ stroke: colors.baseline }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fill: colors.inkMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />

        <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.baseline, strokeWidth: 1 }} />

        <Area
          type="monotone"
          dataKey="preco"
          stroke={colors.seriesZScore}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: colors.seriesZScore, stroke: colors.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
