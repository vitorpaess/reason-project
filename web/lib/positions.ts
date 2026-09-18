import "server-only";
import { supabase } from "./supabase";
import { ENTRY_THRESHOLD } from "./config";
import type { SignalEvent } from "./pairs-data";

export type ManualPosition = {
  id: number;
  par: string;
  data_entrada: string;
  z_entrada: number;
  direcao: string | null;
  data_saida: string | null;
  z_saida: number | null;
};

const TABLE = "posicoes_manuais";

export async function getPositionHistory(par: string): Promise<SignalEvent[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("data_entrada,z_entrada,direcao,data_saida,z_saida")
    .eq("par", par)
    .order("data_entrada", { ascending: false });

  if (error) {
    throw new Error(`Falha ao ler ${TABLE} para ${par}: ${error.message}`);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  return (data ?? []).map((row) => ({
    dataEntrada: row.data_entrada,
    zEntrada: row.z_entrada,
    direcao: row.direcao,
    dataSaida: row.data_saida,
    zSaida: row.z_saida,
    diasEmAberto: daysBetween(row.data_entrada, row.data_saida ?? hoje),
  }));
}

export async function getOpenPosition(par: string): Promise<ManualPosition | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("par", par)
    .is("data_saida", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao ler posição aberta de ${par}: ${error.message}`);
  }
  return data as ManualPosition | null;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function direcaoParaZ(par: string, z: number): string {
  const [a, b] = par.split("/");
  return z > 0 ? `vender ${a} / comprar ${b}` : `comprar ${a} / vender ${b}`;
}

/**
 * Confirma que o usuário realmente entrou na operação. Valida no servidor
 * que ainda faz sentido (sinal ativo, sem posição já aberta) mesmo que o
 * botão só apareça na UI nessas condições — defesa contra clique duplicado
 * ou estado desatualizado no navegador.
 */
export async function enterPosition(
  par: string,
  currentZ: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (currentZ === null || Math.abs(currentZ) <= ENTRY_THRESHOLD) {
    return { ok: false, error: "Não há sinal de entrada ativo para este par agora." };
  }

  const existing = await getOpenPosition(par);
  if (existing) {
    return { ok: false, error: "Já existe uma posição aberta para este par." };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { error } = await supabase()
    .from(TABLE)
    .insert({
      par,
      data_entrada: hoje,
      z_entrada: currentZ,
      direcao: direcaoParaZ(par, currentZ),
    });

  if (error) {
    return { ok: false, error: `Não foi possível registrar a entrada: ${error.message}` };
  }
  return { ok: true };
}

export async function exitPosition(
  par: string,
  currentZ: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getOpenPosition(par);
  if (!existing) {
    return { ok: false, error: "Não há posição aberta para este par." };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { error } = await supabase()
    .from(TABLE)
    .update({
      data_saida: hoje,
      z_saida: currentZ,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) {
    return { ok: false, error: `Não foi possível registrar a saída: ${error.message}` };
  }
  return { ok: true };
}
