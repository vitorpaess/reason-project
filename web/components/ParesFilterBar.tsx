"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { buildQuery } from "@/lib/url-params";
import { colors } from "@/lib/theme";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "oportunidade_entrada", label: "Oportunidade de entrada" },
  { value: "oportunidade_saida", label: "Oportunidade de saída" },
  { value: "em_operacao", label: "Em operação" },
  { value: "espera", label: "Aguardando" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "score_desc", label: "Score — maior primeiro" },
  { value: "score_asc", label: "Score — menor primeiro" },
  { value: "z_desc", label: "|Z| — maior primeiro" },
  { value: "z_asc", label: "|Z| — menor primeiro" },
  { value: "par_asc", label: "Par (A-Z)" },
];

const inputClass =
  "rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-sm text-ink-secondary outline-none focus:border-series";

export function ParesFilterBar({ setores }: { setores: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = Object.fromEntries(searchParams.entries());
  const [search, setSearch] = useState(current.q ?? "");

  function navigate(overrides: Record<string, string | undefined>) {
    router.push(`/dashboard${buildQuery(current, { ...overrides, page: undefined })}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: search || undefined });
  }

  const setorAtivo = current.setor;

  return (
    <div className="flex flex-col gap-3">
      {/* Setor — filtro em destaque, pedido explicitamente pra ficar no topo. */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => navigate({ setor: undefined })}
          className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          style={
            !setorAtivo
              ? { backgroundColor: colors.seriesZScore, color: "#fff" }
              : { backgroundColor: colors.surfaceRaised, color: colors.inkSecondary }
          }
        >
          Todos os setores
        </button>
        {setores.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => navigate({ setor: setorAtivo === s ? undefined : s })}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            style={
              setorAtivo === s
                ? { backgroundColor: colors.seriesZScore, color: "#fff" }
                : { backgroundColor: colors.surfaceRaised, color: colors.inkSecondary }
            }
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="min-w-[160px] flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ticker..."
            className={`w-full ${inputClass}`}
          />
        </form>

        <select
          value={current.status ?? ""}
          onChange={(e) => navigate({ status: e.target.value || undefined })}
          className={inputClass}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={current.sort ?? "score_desc"}
          onChange={(e) => navigate({ sort: e.target.value === "score_desc" ? undefined : e.target.value })}
          className={inputClass}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {(current.q || current.status) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              navigate({ q: undefined, status: undefined });
            }}
            className="text-xs font-medium text-ink-muted transition-colors hover:text-ink-primary"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
