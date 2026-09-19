"use client";

import { useMemo, useState } from "react";
import { RANGE_OPTIONS, rangeStartDate, type RangeKey } from "@/lib/date-ranges";
import type { SignalEvent, ZScoreRow } from "@/lib/pairs-data";
import { ZScoreChart } from "@/components/ZScoreChart";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";
import { CorrelationChart } from "@/components/CorrelationChart";
import { CorrelationTrendBadge } from "@/components/CorrelationTrendCard";

export function PairChartSection({
  rows,
  oportunidades,
}: {
  rows: ZScoreRow[];
  oportunidades: SignalEvent[];
}) {
  const [range, setRange] = useState<RangeKey>("TUDO");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dataMin = rows.length > 0 ? rows[0].data : null;
  const dataMax = rows.length > 0 ? rows[rows.length - 1].data : null;

  const start =
    range === "CUSTOM" ? customStart || dataMin : dataMax ? rangeStartDate(range, dataMax) : null;
  // Presets sempre vão até o dado mais recente (sem limite superior);
  // só o período personalizado tem uma data final própria.
  const end = range === "CUSTOM" ? customEnd || dataMax : null;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => (!start || r.data >= start) && (!end || r.data <= end));
  }, [rows, start, end]);

  // Uma oportunidade "pertence" ao período filtrado se sobrepõe a janela:
  // começou até o fim do período E (ainda está aberta OU terminou depois
  // do início do período) — mesmo que tenha começado antes da janela.
  const filteredOportunidades = useMemo(() => {
    return oportunidades.filter((e) => {
      const comecouAntesDoFim = !end || e.dataEntrada <= end;
      const terminouDepoisDoInicio = e.dataSaida === null || !start || e.dataSaida >= start;
      return comecouAntesDoFim && terminouDepoisDoInicio;
    });
  }, [oportunidades, start, end]);

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-x-1 gap-y-2">
          {range === "CUSTOM" && (
            <div className="mr-auto flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="date"
                value={customStart || dataMin || ""}
                min={dataMin ?? undefined}
                max={customEnd || dataMax || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-border-strong bg-surface-raised px-2 py-1 text-ink-secondary outline-none focus:border-series"
              />
              <span>até</span>
              <input
                type="date"
                value={customEnd || dataMax || ""}
                min={customStart || dataMin || undefined}
                max={dataMax ?? undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-border-strong bg-surface-raised px-2 py-1 text-ink-secondary outline-none focus:border-series"
              />
            </div>
          )}
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === opt.key
                  ? "bg-surface-raised text-ink-primary"
                  : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filteredRows.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">
            Sem dados no período selecionado.
          </p>
        ) : (
          <ZScoreChart rows={filteredRows} events={filteredOportunidades} />
        )}
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Histórico de oportunidades</h2>
        <SignalHistoryTable oportunidades={filteredOportunidades} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-secondary">Correlação móvel</h2>
          <CorrelationTrendBadge rows={filteredRows} />
        </div>
        <CorrelationChart rows={filteredRows} />
      </div>
    </div>
  );
}
