import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ENTRY_THRESHOLD, ROLLING_WINDOW_DAYS, type PairDef } from "@/lib/config";
import { statusColor, statusLabel } from "@/lib/theme";
import { PairIcon } from "@/lib/pair-icons";
import type { PairStatus } from "@/lib/pairs-data";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { PositionControl } from "@/components/PositionControl";
import { PairChartSection } from "@/components/PairChartSection";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function PairOverview({
  pairDef,
  status,
  detailHref,
}: {
  pairDef: PairDef;
  status: PairStatus;
  /** Se informado, mostra um link "Ver detalhes" (uso na visão geral /dashboard). */
  detailHref?: string;
}) {
  return (
    <div>
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PairIcon slug={pairDef.slug} size={10} />
          <h1 className="text-xl font-semibold text-ink-primary">{pairDef.label}</h1>
        </div>
        {detailHref && (
          <Link
            href={detailHref}
            className="flex items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink-primary"
          >
            Ver detalhes
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </Link>
        )}
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
              {status.estado === "oportunidade_entrada" && (
                <PositionControl par={pairDef.label} action="entrar" />
              )}
              {status.estado === "oportunidade_saida" && (
                <PositionControl par={pairDef.label} action="sair" />
              )}
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

          <PairChartSection rows={status.rows} oportunidades={status.oportunidades} />
        </>
      )}
    </div>
  );
}

function StatusDetail({ status }: { status: PairStatus }) {
  if (status.estado === "oportunidade_entrada") {
    return <span>|z| passou de {ENTRY_THRESHOLD.toFixed(2)} — confirme se entrou na operação</span>;
  }
  if (status.estado === "em_operacao" && status.openPosition) {
    const e = status.openPosition;
    return (
      <span>
        desde {formatDate(e.dataEntrada)} ({e.diasEmAberto}d) — {e.direcao}
      </span>
    );
  }
  if (status.estado === "oportunidade_saida" && status.openPosition) {
    const e = status.openPosition;
    return (
      <span>
        entrada em {formatDate(e.dataEntrada)} ({e.diasEmAberto}d) — |z| voltou pra zona de saída
      </span>
    );
  }
  return <span>aguardando |z| &gt; {ENTRY_THRESHOLD.toFixed(2)}</span>;
}
