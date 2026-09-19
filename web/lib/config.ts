// Espelha config.py — mesmos pares e parâmetros usados no cálculo Python.

export type PairDef = { slug: string; label: string; a: string; b: string };

export const PAIRS: PairDef[] = [
  { slug: "RKLB-PL", label: "RKLB/PL", a: "RKLB", b: "PL" },
  { slug: "RPD-TENB", label: "RPD/TENB", a: "RPD", b: "TENB" },
  { slug: "ALGT-CPA", label: "ALGT/CPA", a: "ALGT", b: "CPA" },
];

export const ENTRY_THRESHOLD = 1.2;
export const EXIT_THRESHOLD = 0.5;
export const ROLLING_WINDOW_DAYS = 63;

export function pairBySlug(slug: string): PairDef | undefined {
  return PAIRS.find((p) => p.slug === slug);
}
