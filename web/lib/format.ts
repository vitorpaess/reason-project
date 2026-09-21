// Formatadores pequenos reusados por mais de um componente (ParSquare,
// RankingTable) — sem I/O, sem estado.

export function formatPct(v: number | null, casas: number): string {
  if (v === null) return "—";
  const sinal = v > 0 ? "+" : "";
  return `${sinal}${(v * 100).toFixed(casas)}%`;
}
