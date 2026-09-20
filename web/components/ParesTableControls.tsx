"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { buildQuery } from "@/lib/url-params";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "oportunidade_entrada", label: "Oportunidade de entrada" },
  { value: "oportunidade_saida", label: "Oportunidade de saída" },
  { value: "em_operacao", label: "Em operação" },
  { value: "espera", label: "Aguardando" },
];

const inputClass =
  "rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-sm text-ink-secondary outline-none focus:border-series";

export function ParesTableControls({ setores }: { setores: string[] }) {
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[180px]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ticker..."
          className={`w-full ${inputClass}`}
        />
      </form>

      <select
        value={current.setor ?? ""}
        onChange={(e) => navigate({ setor: e.target.value || undefined })}
        className={inputClass}
      >
        <option value="">Todos os setores</option>
        {setores.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

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

      {(current.q || current.setor || current.status) && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push("/dashboard");
          }}
          className="text-xs font-medium text-ink-muted transition-colors hover:text-ink-primary"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
