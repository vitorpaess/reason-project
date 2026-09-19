import type { SignalEvent } from "@/lib/pairs-data";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSigned(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

export function SignalHistoryTable({ oportunidades }: { oportunidades: SignalEvent[] }) {
  if (oportunidades.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhuma oportunidade ainda.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-2.5 font-medium">Entrada</th>
            <th className="px-4 py-2.5 font-medium">z entrada</th>
            <th className="px-4 py-2.5 font-medium">Direção</th>
            <th className="px-4 py-2.5 font-medium">Saída</th>
            <th className="px-4 py-2.5 font-medium">z saída</th>
            <th className="px-4 py-2.5 font-medium">Pico do z-score</th>
            <th className="px-4 py-2.5 text-right font-medium">Duração</th>
          </tr>
        </thead>
        <tbody>
          {oportunidades.map((evento, i) => (
            <tr
              key={`${evento.dataEntrada}-${i}`}
              className="border-b border-border bg-surface last:border-b-0"
            >
              <td className="px-4 py-2.5 text-ink-secondary">{formatDate(evento.dataEntrada)}</td>
              <td className="px-4 py-2.5 tabular-nums text-ink-primary">
                {evento.zEntrada.toFixed(2)}
              </td>
              <td className="px-4 py-2.5 text-ink-muted">{evento.direcao ?? "—"}</td>
              <td className="px-4 py-2.5 text-ink-secondary">
                {evento.dataSaida ? (
                  formatDate(evento.dataSaida)
                ) : (
                  <span className="text-status-critical">em aberto</span>
                )}
              </td>
              <td className="px-4 py-2.5 tabular-nums text-ink-primary">
                {evento.zSaida !== null ? evento.zSaida.toFixed(2) : "—"}
              </td>
              <td className="px-4 py-2.5 tabular-nums font-medium text-ink-primary">
                {formatSigned(evento.pico)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-ink-primary">
                {evento.diasEmAberto}d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
