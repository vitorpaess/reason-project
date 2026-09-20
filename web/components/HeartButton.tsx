"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { colors } from "@/lib/theme";

export function HeartButton({ par, inicial }: { par: string; inicial: boolean }) {
  const router = useRouter();
  const [favorito, setFavorito] = useState(inicial);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const proximoEstado = !favorito;
    setFavorito(proximoEstado); // otimista — a maioria das vezes acerta

    const res = await fetch("/api/favoritos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ par }),
    });

    setLoading(false);

    if (!res.ok) {
      setFavorito(!proximoEstado); // desfaz se falhou
      return;
    }
    router.refresh(); // atualiza a sidebar (favoritos) sem recarregar a página
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-pressed={favorito}
      aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className="flex items-center justify-center rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      <Heart
        size={18}
        strokeWidth={1.75}
        fill={favorito ? colors.seriesZScore : "none"}
        color={favorito ? colors.seriesZScore : colors.inkMuted}
      />
    </button>
  );
}
