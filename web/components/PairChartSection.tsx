"use client";

import { useMemo, useState } from "react";
import { RANGE_OPTIONS, rangeStartDate, type RangeKey } from "@/lib/date-ranges";
import type { SignalEvent, ZScoreRow } from "@/lib/pairs-data";
import { ZScoreChart } from "@/components/ZScoreChart";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";

export function PairChartSection({
  rows,
  oportunidades,
}: {
  rows: ZScoreRow[];
  oportunidades: SignalEvent[];
}) {
  const [range, setRange] = useState<RangeKey>("TUDO");

  const mostRecent = rows.length > 0 ? rows[rows.length - 1].data : null;
  const start = mostRecent ? rangeStartDate(range, mostRecent) : null;

  const filteredRows = useMemo(() => {
    if (!start) return rows;
    return rows.filter((r) => r.data >= start);
  }, [rows, start]);

  // Uma oportunidade "pertence" ao período filtrado se ainda está em
  // aberto (segue relevante até hoje) ou se foi encerrada dentro da
  // janela — mesmo que tenha começado antes do início do período.
  const filteredOportunidades = useMemo(() => {
    if (!start) return oportunidades;
    return oportunidades.filter((e) => e.dataSaida === null || e.dataSaida >= start);
  }, [oportunidades, start]);

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
          <ZScoreChart rows={filteredRows} events={filteredOportunidades} />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Histórico de oportunidades</h2>
        <SignalHistoryTable oportunidades={filteredOportunidades} />
      </div>
    </div>
  );
}
