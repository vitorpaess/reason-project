"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/theme";

export function PositionControl({
  par,
  action,
}: {
  par: string;
  action: "entrar" | "sair";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnter = action === "entrar";
  const endpoint = isEnter ? "/api/positions/enter" : "/api/positions/exit";
  const label = isEnter ? "Marcar entrada" : "Marcar saída";
  const color = isEnter ? colors.statusCritical : colors.statusGood;

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ par }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível registrar.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border bg-transparent px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ borderColor: `${color}55`, color }}
      >
        {loading ? "Confirmando…" : label}
      </button>
      {error && <p className="mt-1.5 text-xs text-status-critical">{error}</p>}
    </div>
  );
}
