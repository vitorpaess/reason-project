import type { SignalEvent } from "@/lib/pairs-data";

function formatMoment(iso: string, hora: number | null): string {
  const d = new Date(iso + "T00:00:00");
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return hora !== null ? `${data}, ~${hora}h` : data;
}

export function SignalHistoryTable({ oportunidades }: { oportunidades: SignalEvent[] }) {
  if (oportunidades.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhuma oportunidade ainda.</p>;
  }

  const temEstimada = oportunidades.some((e) => e.estimada);
  const temInterpolada = oportunidades.some((e) => e.horaEntrada !== null || e.horaSaida !== null);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2.5 font-medium">Entrada (estimada)</th>
              <th className="px-4 py-2.5 font-medium">z entrada</th>
              <th className="px-4 py-2.5 font-medium">Direção</th>
              <th className="px-4 py-2.5 font-medium">Saída (estimada)</th>
              <th className="px-4 py-2.5 font-medium">z saída</th>
              <th className="px-4 py-2.5 text-right font-medium">Duração</th>
            </tr>
          </thead>
          <tbody>
            {oportunidades.map((evento, i) => (
              <tr
                key={`${evento.dataEntrada}-${i}`}
                className="border-b border-border bg-surface last:border-b-0"
              >
                <td className="px-4 py-2.5 text-ink-secondary">
                  {formatMoment(evento.dataEntrada, evento.horaEntrada)}
                  {evento.estimada && (
                    <span
                      className="ml-1.5 text-ink-muted"
                      title="Estimada com o z-score expansivo — período anterior aos 63 dias oficiais"
                    >
                      *
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-ink-primary">
                  {evento.zEntrada.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{evento.direcao ?? "—"}</td>
                <td className="px-4 py-2.5 text-ink-secondary">
                  {evento.dataSaida ? (
                    formatMoment(evento.dataSaida, evento.horaSaida)
                  ) : (
                    <span className="text-status-critical">em aberto</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-ink-primary">
                  {evento.zSaida !== null ? evento.zSaida.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-primary">
                  {evento.diasEmAberto.toFixed(1)}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(temEstimada || temInterpolada) && (
        <p className="mt-2 space-y-0.5 text-xs text-ink-muted">
          {temInterpolada && (
            <span className="block">
              Entrada/saída são o momento exato estimado do cruzamento do limiar (1,20/0,50),
              interpolado entre o fechamento do dia anterior e o do dia seguinte — não o horário
              real observado, já que só temos 1 preço por dia.
            </span>
          )}
          {temEstimada && (
            <span className="block">
              * estimada com o z-score expansivo (período anterior aos 63 dias oficiais, não seria
              um sinal real de entrada/saída)
            </span>
          )}
        </p>
      )}
    </div>
  );
}
