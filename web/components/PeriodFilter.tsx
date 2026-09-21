"use client";

import { RANGE_OPTIONS, type RangeKey } from "@/lib/date-ranges";

export function PeriodFilter({
  range,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  dataMin,
  dataMax,
}: {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  dataMin: string | null;
  dataMax: string | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-x-1 gap-y-2">
      {range === "CUSTOM" && (
        <div className="mr-auto flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="date"
            value={customStart || dataMin || ""}
            min={dataMin ?? undefined}
            max={customEnd || dataMax || undefined}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-raised px-2 py-1 text-ink-secondary outline-none focus:border-series"
          />
          <span>até</span>
          <input
            type="date"
            value={customEnd || dataMax || ""}
            min={customStart || dataMin || undefined}
            max={dataMax ?? undefined}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-raised px-2 py-1 text-ink-secondary outline-none focus:border-series"
          />
        </div>
      )}
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onRangeChange(opt.key)}
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
  );
}
