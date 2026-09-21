"use client";

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "@/lib/theme";
import type { HalfLifePoint } from "@/lib/mean-reversion";

// Meia-vida pode disparar pra centenas/milhares de dias quando b fica bem
// perto de 0 (reversão fraquíssima) — matematicamente válido, mas não dá
// pra confiar numa meia-vida maior que a própria janela usada pra
// estimá-la, e deixaria o eixo Y ilegível. Recorta a exibição (só visual —
// o valor bruto continua disponível no card/alerta).
const TETO_EXIBICAO_DIAS = 250;

type ChartPoint = { data: string; curta: number | null; longa: number | null };

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
      <div className="mt-0.5 font-semibold tabular-nums" style={{ color: colors.seriesZScore }}>
        curta: {point.curta !== null ? `${point.curta.toFixed(0)}d` : "sem reversão"}
      </div>
      <div className="font-semibold tabular-nums" style={{ color: colors.inkSecondary }}>
        longa: {point.longa !== null ? `${point.longa.toFixed(0)}d` : "sem reversão"}
      </div>
    </div>
  );
}

export function HalfLifeChart({ curta, longa }: { curta: HalfLifePoint[]; longa: HalfLifePoint[] }) {
  const mapaLonga = new Map(longa.map((p) => [p.data, p.meiaVida]));

  const points: ChartPoint[] = curta.map((p) => ({
    data: p.data,
    curta: p.meiaVida !== null ? Math.min(p.meiaVida, TETO_EXIBICAO_DIAS) : null,
    longa: (() => {
      const v = mapaLonga.get(p.data);
      return v !== undefined && v !== null ? Math.min(v, TETO_EXIBICAO_DIAS) : null;
    })(),
  }));

  const temAlgumDado = points.some((p) => p.curta !== null || p.longa !== null);
  if (!temAlgumDado) {
    return (
      <p className="py-16 text-center text-sm text-ink-muted">
        Histórico curto demais pra estimar meia-vida ({curta.length} dia(s) disponíveis).
      </p>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
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
            domain={[0, TETO_EXIBICAO_DIAS]}
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
            dot={false}
            activeDot={{ r: 3, fill: colors.inkSecondary, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="curta"
            stroke={colors.seriesZScore}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: colors.seriesZScore, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
        <LegendLine color={colors.seriesZScore} label="Meia-vida curta (50d)" dashed={false} />
        <LegendLine color={colors.inkSecondary} label="Meia-vida longa (200d)" dashed />
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
