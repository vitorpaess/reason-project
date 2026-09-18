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
import type { DotProps } from "recharts";
import { colors } from "@/lib/theme";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "@/lib/config";
import type { SignalEvent, ZScoreRow } from "@/lib/pairs-data";

type Marker = "entrada" | "saida" | "nenhum";

type ChartPoint = {
  data: string;
  z_score: number;
  marker: Marker;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function EventDot(props: DotProps & { payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (!payload || payload.marker === "nenhum" || cx === undefined || cy === undefined) {
    return <g />;
  }
  const color = payload.marker === "entrada" ? colors.statusCritical : colors.statusGood;
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke={colors.surface} strokeWidth={1.5} />;
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
        z = {point.z_score.toFixed(2)}
      </div>
      {point.marker !== "nenhum" && (
        <div
          className="mt-0.5 font-medium"
          style={{ color: point.marker === "entrada" ? colors.statusCritical : colors.statusGood }}
        >
          {point.marker === "entrada" ? "Entrada confirmada" : "Saída confirmada"}
        </div>
      )}
    </div>
  );
}

export function ZScoreChart({
  rows,
  events = [],
}: {
  rows: ZScoreRow[];
  /** Posições confirmadas pelo usuário — marcam os pontos de entrada/saída reais no gráfico. */
  events?: SignalEvent[];
}) {
  const entryDates = new Set(events.map((e) => e.dataEntrada));
  const exitDates = new Set(events.filter((e) => e.dataSaida).map((e) => e.dataSaida as string));

  const points: ChartPoint[] = rows
    .filter((r) => r.z_score !== null)
    .map((r) => {
      let marker: Marker = "nenhum";
      if (entryDates.has(r.data)) marker = "entrada";
      else if (exitDates.has(r.data)) marker = "saida";
      return { data: r.data, z_score: r.z_score as number, marker };
    });

  const values = points.map((p) => p.z_score);
  // Arredonda pra baixo/cima em passos de 0.1 — o domínio do eixo Y nunca
  // deve carregar a precisão de ponto flutuante bruta de um z_score (ex:
  // 1.2623710221725113), senão o gerador automático de ticks do Recharts
  // pode produzir rótulos absurdos a partir dessas casas decimais.
  const yMax = Math.ceil((Math.max(...values, ENTRY_THRESHOLD) + 0.3) * 10) / 10;
  const yMin = Math.floor((Math.min(...values, -ENTRY_THRESHOLD) - 0.3) * 10) / 10;

  // Ticks explícitos: sempre mostra os dois limiares (entrada/saída, nos
  // dois sinais) como rótulo numérico exato, além dos extremos do gráfico.
  const yTicks = Array.from(
    new Set([yMin, -ENTRY_THRESHOLD, -EXIT_THRESHOLD, 0, EXIT_THRESHOLD, ENTRY_THRESHOLD, yMax])
  ).sort((a, b) => a - b);

  return (
    <div>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="zscore-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.seriesZScore} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colors.seriesZScore} stopOpacity={0} />
            </linearGradient>
          </defs>

          <ReferenceArea
            y1={ENTRY_THRESHOLD}
            y2={yMax}
            fill={colors.statusCritical}
            fillOpacity={0.08}
            strokeWidth={0}
          />
          <ReferenceArea
            y1={yMin}
            y2={-ENTRY_THRESHOLD}
            fill={colors.statusCritical}
            fillOpacity={0.08}
            strokeWidth={0}
          />
          <ReferenceArea
            y1={-EXIT_THRESHOLD}
            y2={EXIT_THRESHOLD}
            fill={colors.statusGood}
            fillOpacity={0.07}
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
            domain={[yMin, yMax]}
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
            dataKey="z_score"
            stroke={colors.seriesZScore}
            strokeWidth={2.5}
            fill="url(#zscore-fill)"
            dot={<EventDot />}
            activeDot={{ r: 4, fill: colors.seriesZScore, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
        <LegendDot color={colors.statusCritical} label={`Zona de entrada · |z| > ${ENTRY_THRESHOLD}`} />
        <LegendDot color={colors.statusGood} label={`Zona de saída · |z| < ${EXIT_THRESHOLD}`} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
