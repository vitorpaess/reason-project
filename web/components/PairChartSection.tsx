"use client";

import { useMemo, useState } from "react";
import { RANGE_OPTIONS, rangeStartDate, type RangeKey } from "@/lib/date-ranges";
import type { SignalEvent, ZScoreRow } from "@/lib/pairs-data";
import { ZScoreChart } from "@/components/ZScoreChart";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";

export function PairChartSection({
  rows,
  historico,
}: {
  rows: ZScoreRow[];
  historico: SignalEvent[];
}) {
  const [range, setRange] = useState<RangeKey>("TUDO");

  const mostRecent = rows.length > 0 ? rows[rows.length - 1].data : null;
  const start = mostRecent ? rangeStartDate(range, mostRecent) : null;

  const filteredRows = useMemo(() => {
    if (!start) return rows;
    return rows.filter((r) => r.data >= start);
  }, [rows, start]);

  // Um sinal "pertence" ao período filtrado se ainda está aberto (segue
  // relevante até hoje) ou se foi encerrado dentro da janela — mesmo que a
  // entrada tenha sido antes do início do período.
  const filteredHistorico = useMemo(() => {
    if (!start) return historico;
    return historico.filter((e) => e.dataSaida === null || e.dataSaida >= start);
  }, [historico, start]);

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-end gap-1">
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
          <ZScoreChart rows={filteredRows} events={filteredHistorico} />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Histórico de posições</h2>
        <SignalHistoryTable historico={filteredHistorico} />
      </div>
    </div>
  );
}
