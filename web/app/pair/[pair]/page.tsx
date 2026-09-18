import { notFound } from "next/navigation";
import { ENTRY_THRESHOLD, ROLLING_WINDOW_DAYS, pairBySlug } from "@/lib/config";
import { getPairStatus } from "@/lib/pairs-data";
import { statusColor, statusLabel } from "@/lib/theme";
import { PairIcon } from "@/lib/pair-icons";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { ZScoreChart } from "@/components/ZScoreChart";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";

// Renderizado por requisição — os dados vêm do Supabase e mudam todo dia
// útil via a rotina agendada, então nunca devem ficar congelados num
// build estático.
export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default async function PairPage({ params }: PageProps<"/pair/[pair]">) {
  const { pair: slug } = await params;
  const pairDef = pairBySlug(slug);
  if (!pairDef) notFound();

  const status = await getPairStatus(pairDef.label);

  return (
    <div>
      <div className="mb-7 flex items-center gap-2.5">
        <PairIcon slug={pairDef.slug} size={10} />
        <h1 className="text-xl font-semibold text-ink-primary">{pairDef.label}</h1>
      </div>

      {status.estado === null || !status.ultimo ? (
        <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-secondary">
          Histórico insuficiente ainda para calcular z-score/correlação (janela de{" "}
          {ROLLING_WINDOW_DAYS} dias). Aguarde mais coletas diárias.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Status" detail={<StatusDetail status={status} />}>
              <StatusPill label={statusLabel[status.estado]} color={statusColor(status.estado)} />
            </StatCard>

            <StatCard label="Z-score atual">
              <span className="text-xl font-semibold tabular-nums text-ink-primary">
                {status.ultimo.z_score?.toFixed(2)}
              </span>
            </StatCard>

            <StatCard
              label={`Correlação móvel ${ROLLING_WINDOW_DAYS}d`}
              detail={
                status.ultimo.correlacao_movel_63d !== null &&
                Math.abs(status.ultimo.correlacao_movel_63d) < 0.5
                  ? "Correlação baixa — par pode estar perdendo a relação estatística."
                  : undefined
              }
            >
              <span className="text-xl font-semibold tabular-nums text-ink-primary">
                {status.ultimo.correlacao_movel_63d !== null
                  ? status.ultimo.correlacao_movel_63d.toFixed(2)
                  : "N/D"}
              </span>
            </StatCard>
          </div>

          <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
            <ZScoreChart rows={status.rows} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Histórico de sinais</h2>
            <SignalHistoryTable historico={status.historico} />
          </div>
        </>
      )}
    </div>
  );
}

function StatusDetail({
  status,
}: {
  status: Awaited<ReturnType<typeof getPairStatus>>;
}) {
  if (status.estado === "aberta" && status.historico[0]) {
    const e = status.historico[0];
    return (
      <span>
        desde {formatDate(e.dataEntrada)} ({e.diasEmAberto}d) — {e.direcao}
      </span>
    );
  }
  if (status.estado === "saida" && status.historico[0]) {
    const e = status.historico[0];
    return (
      <span>
        entrada em {formatDate(e.dataEntrada)} (z {e.zEntrada.toFixed(2)}) → saída hoje
      </span>
    );
  }
  return <span>aguardando |z| &gt; {ENTRY_THRESHOLD.toFixed(2)}</span>;
}
