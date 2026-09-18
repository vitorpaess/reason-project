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
  oportunidade_entrada: "Oportunidade de entrada",
  oportunidade_saida: "Oportunidade de saída",
  em_operacao: "Em operação",
  espera: "Aguardando",
};

// oportunidade_entrada = vermelho (mesma cor da zona de entrada no gráfico)
// oportunidade_saida   = verde (mesma cor da zona de saída no gráfico)
// em_operacao          = azul (informativo: posicionado, mas ainda não é
//                        hora de considerar sair)
// espera               = cinza (nada a fazer agora)
export function statusColor(estado: string): string {
  if (estado === "oportunidade_entrada") return colors.statusCritical;
  if (estado === "oportunidade_saida") return colors.statusGood;
  if (estado === "em_operacao") return colors.seriesZScore;
  return colors.inkMuted;
}
