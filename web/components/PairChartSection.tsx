"use client";

import { useMemo, useState } from "react";
import { rangeStartDate, type RangeKey } from "@/lib/date-ranges";
import type { SignalEvent, ZScoreRow } from "@/lib/pairs-data";
import { ZScoreChart } from "@/components/ZScoreChart";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";
import { MeanReversionSection } from "@/components/MeanReversionSection";
import { PeriodFilter } from "@/components/PeriodFilter";

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
        <PeriodFilter
          range={range}
          onRangeChange={setRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          dataMin={dataMin}
          dataMax={dataMax}
        />

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

      <MeanReversionSection rows={rows} />
    </div>
  );
}
