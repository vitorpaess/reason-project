"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DotProps } from "recharts";
import { colors } from "@/lib/theme";
import { pickTicks } from "@/lib/chart-utils";
import type { HalfLifePoint } from "@/lib/mean-reversion";

// Meia-vida pode disparar pra centenas/milhares de dias quando b fica bem
// perto de 0 (reversão fraquíssima) — matematicamente válido, mas não dá
// pra confiar numa meia-vida maior que a própria janela usada pra
// estimá-la, e deixaria o eixo Y ilegível. Pontos "sem reversão" (b>=0)
// ficam pregados nesse teto, com um marcador vermelho distinto (não são o
// mesmo tipo de dado que um valor alto porém finito).
const TETO_EXIBICAO_DIAS = 250;
const Y_TICKS = [1, 2, 5, 10, 25, 50, 100, TETO_EXIBICAO_DIAS];
const MAX_X_TICKS = 8;

type ChartPoint = {
  data: string;
  curta: number | null;
  curtaSemReversao: boolean;
  longa: number | null;
  longaSemReversao: boolean;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
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
      <div className="mt-0.5 font-semibold tabular-nums" style={{ color: colors.seriesZScore }}>
        curta: {point.curtaSemReversao ? "sem reversão" : point.curta !== null ? `${point.curta.toFixed(0)}d` : "—"}
      </div>
      <div className="font-semibold tabular-nums" style={{ color: colors.inkSecondary }}>
        longa: {point.longaSemReversao ? "sem reversão" : point.longa !== null ? `${point.longa.toFixed(0)}d` : "—"}
      </div>
    </div>
  );
}

function SemReversaoDot(props: DotProps & { payload?: ChartPoint; campo: "curta" | "longa" }) {
  const { cx, cy, payload, campo } = props;
  const flag = campo === "curta" ? payload?.curtaSemReversao : payload?.longaSemReversao;
  if (!flag || cx === undefined || cy === undefined) return <g />;
  return <circle cx={cx} cy={cy} r={3.5} fill={colors.statusCritical} stroke={colors.surface} strokeWidth={1} />;
}

export function HalfLifeChart({ curta, longa }: { curta: HalfLifePoint[]; longa: HalfLifePoint[] }) {
  const mapaLonga = new Map(longa.map((p) => [p.data, p]));

  const points: ChartPoint[] = curta.map((p) => {
    const pLonga = mapaLonga.get(p.data);
    return {
      data: p.data,
      curta: p.semReversao ? TETO_EXIBICAO_DIAS : p.meiaVida !== null ? Math.min(p.meiaVida, TETO_EXIBICAO_DIAS) : null,
      curtaSemReversao: p.semReversao,
      longa: pLonga?.semReversao
        ? TETO_EXIBICAO_DIAS
        : pLonga?.meiaVida != null
          ? Math.min(pLonga.meiaVida, TETO_EXIBICAO_DIAS)
          : null,
      longaSemReversao: pLonga?.semReversao ?? false,
    };
  });

  const temAlgumDado = points.some((p) => p.curta !== null || p.longa !== null);
  if (!temAlgumDado) {
    return (
      <p className="py-16 text-center text-sm text-ink-muted">
        Histórico curto demais pra estimar meia-vida ({curta.length} dia(s) disponíveis).
      </p>
    );
  }

  const xTicks = pickTicks(points.map((p) => p.data), MAX_X_TICKS);

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
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
            scale="log"
            domain={[1, TETO_EXIBICAO_DIAS]}
            ticks={Y_TICKS}
            tickFormatter={(v: number) => `${v}d`}
            tick={{ fill: colors.inkMuted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />

          <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.baseline, strokeWidth: 1 }} />

          <Line
            type="monotone"
            dataKey="longa"
            stroke={colors.inkSecondary}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={<SemReversaoDot campo="longa" />}
            activeDot={{ r: 3, fill: colors.inkSecondary, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="curta"
            stroke={colors.seriesZScore}
            strokeWidth={2}
            dot={<SemReversaoDot campo="curta" />}
            activeDot={{ r: 4, fill: colors.seriesZScore, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
        <LegendLine color={colors.seriesZScore} label="Meia-vida curta (50d)" dashed={false} />
        <LegendLine color={colors.inkSecondary} label="Meia-vida longa (200d)" dashed />
        <LegendDot color={colors.statusCritical} label="Sem reversão nessa janela" />
      </div>
    </div>
  );
}

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="14" height="8">
        <line
          x1="0"
          y1="4"
          x2="14"
          y2="4"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
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
