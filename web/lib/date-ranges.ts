export type RangeKey = "1D" | "1S" | "1M" | "3M" | "1A" | "5A" | "TUDO";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "1D", label: "1D" },
  { key: "1S", label: "1S" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1A", label: "1A" },
  { key: "5A", label: "5A" },
  { key: "TUDO", label: "Tudo" },
];

/**
 * Data de corte (inclusive) para um filtro de período, ancorada no dado mais
 * recente disponível (não em "hoje" do relógio local) — assim o filtro
 * sempre se refere ao que existe no banco, mesmo se a coleta do dia ainda
 * não rodou. Retorna null para "TUDO" (sem corte).
 */
export function rangeStartDate(key: RangeKey, mostRecentIso: string): string | null {
  if (key === "TUDO") return null;

  const start = new Date(mostRecentIso + "T00:00:00");
  switch (key) {
    case "1D":
      start.setDate(start.getDate() - 2);
      break;
    case "1S":
      start.setDate(start.getDate() - 7);
      break;
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "1A":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "5A":
      start.setFullYear(start.getFullYear() - 5);
      break;
  }
  return start.toISOString().slice(0, 10);
}
