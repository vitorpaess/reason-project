import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "@/lib/config";
import { colors } from "@/lib/theme";
import type { Estado } from "@/lib/pairs-data";

/**
 * Barra mostrando a distância do |z| atual até o próximo gatilho relevante:
 * o de entrada (se ainda não há posição) ou o de saída (se já há uma
 * posição em aberto e o alvo passa a ser voltar pra zona de saída).
 */
export function ThresholdProgress({ z, estado }: { z: number; estado: Estado }) {
  const az = Math.abs(z);
  const emOperacao = estado === "em_operacao" || estado === "oportunidade_saida";

  let progresso: number;
  let cor: string;
  let rotulo: string;

  if (emOperacao) {
    const atingiu = az <= EXIT_THRESHOLD;
    progresso = atingiu ? 100 : Math.min((EXIT_THRESHOLD / az) * 100, 100);
    cor = colors.statusGood;
    rotulo = atingiu
      ? "gatilho de saída atingido"
      : `faltam ${(az - EXIT_THRESHOLD).toFixed(2)} até a zona de saída`;
  } else {
    const atingiu = az >= ENTRY_THRESHOLD;
    progresso = Math.min((az / ENTRY_THRESHOLD) * 100, 100);
    cor = colors.statusCritical;
    rotulo = atingiu
      ? "gatilho de entrada atingido"
      : `faltam ${(ENTRY_THRESHOLD - az).toFixed(2)} até a zona de entrada`;
  }

  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progresso}%`, backgroundColor: cor }}
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">{rotulo}</p>
    </div>
  );
}
