import Link from "next/link";
import { statusColor, statusLabel, colors, hexToRgba } from "@/lib/theme";
import { formatPct } from "@/lib/format";
import type { ParStatusRow } from "@/lib/pares-repo";

export function ParSquare({ row, score }: { row: ParStatusRow; score?: number | null }) {
  const cor = row.estado ? statusColor(row.estado) : colors.inkMuted;
  const titulo = [
    row.setor,
    row.correlacao !== null ? `correlação ${row.correlacao.toFixed(2)}` : null,
    row.zScore !== null ? `z ${row.zScore.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Score de oportunidade (lib/ranking.ts) é o valor principal exibido —
  // z-score continua disponível no tooltip e no gráfico/painel do par.
  const temScore = score !== undefined && score !== null;

  return (
    <Link
      href={`/pair/${row.tickerA}-${row.tickerB}`}
      title={titulo}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-transform hover:z-10 hover:scale-[1.04]"
      style={{
        borderColor: row.estado ? hexToRgba(cor, 0.35) : colors.border,
        backgroundColor: row.estado ? hexToRgba(cor, 0.08) : colors.surface,
      }}
    >
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink-secondary">
        {row.par}
      </span>
      <span className="text-base font-bold tabular-nums" style={{ color: cor }}>
        {temScore ? formatPct(score as number, 2) : "—"}
      </span>
      {row.estado && (
        <span className="text-[9px] font-medium leading-none" style={{ color: cor }}>
          {statusLabel[row.estado]}
        </span>
      )}
    </Link>
  );
}
