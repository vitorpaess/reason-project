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
  z_expansivo: number;
  z_63d: number | null;
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
        z histórico = {point.z_expansivo.toFixed(2)}
      </div>
      <div className="tabular-nums text-ink-muted">
        z oficial (63d) = {point.z_63d !== null ? point.z_63d.toFixed(2) : "N/D"}
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
  /** Oportunidades oficiais (63d) — marcam os pontos de entrada/saída no gráfico. */
  events?: SignalEvent[];
}) {
  const entryDates = new Set(events.map((e) => e.dataEntrada));
  const exitDates = new Set(events.filter((e) => e.dataSaida).map((e) => e.dataSaida as string));

  // A linha plotada é sempre o z-score expansivo (histórico) — cobre
  // desde o início dos dados, diferente do card "Z-score atual" no topo
  // (que usa a janela móvel de 63 dias, o cálculo oficial).
  const points: ChartPoint[] = rows
    .filter((r) => r.z_score_expansivo !== null)
    .map((r) => {
      let marker: Marker = "nenhum";
      if (entryDates.has(r.data)) marker = "entrada";
      else if (exitDates.has(r.data)) marker = "saida";
      return {
        data: r.data,
        z_expansivo: r.z_score_expansivo as number,
        z_63d: r.z_score_63d,
        marker,
      };
    });

  const values = points.map((p) => p.z_expansivo);
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
      <div className="mb-3 flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.seriesZScore }} />
        <span>
          Z-score histórico (janela expansiva, todos os dias) — diferente do{" "}
          <span className="text-ink-secondary">z-score atual (janela móvel 63d)</span> mostrado no
          card acima
        </span>
      </div>

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
            dataKey="z_expansivo"
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
