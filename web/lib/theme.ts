// Tokens de cor — mesma paleta validada (contraste/CVD) usada no dashboard
// Python original (theme.py), agora como constantes TS para uso no Recharts
// (que precisa de strings de cor reais, não classes Tailwind).

export const colors = {
  pageBg: "#0d0d0d",
  surface: "#1a1a19",
  surfaceRaised: "#212120",
  border: "rgba(255,255,255,0.08)",
  inkPrimary: "#ffffff",
  inkSecondary: "#c3c2b7",
  inkMuted: "#898781",
  gridline: "#2c2c2a",
  baseline: "#383835",
  seriesZScore: "#3987e5",
  statusCritical: "#d03b3b",
  statusGood: "#0ca30c",
} as const;

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const statusLabel: Record<string, string> = {
  aberta: "Posição aberta",
  saida: "Posição de saída",
  espera: "Posição de espera",
};

export function statusColor(estado: string): string {
  if (estado === "aberta") return colors.statusCritical;
  if (estado === "saida") return colors.statusGood;
  return colors.inkMuted;
}
