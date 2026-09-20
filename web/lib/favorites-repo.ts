import "server-only";
import { supabase } from "./supabase";
import { estadoFromRow } from "./pares-repo";
import type { Estado } from "./pairs-data";

const TABLE = "pares_favoritos";

export async function isFavorite(par: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("par")
    .eq("par", par)
    .maybeSingle();

  if (error) throw new Error(`Falha ao checar favorito de ${par}: ${error.message}`);
  return data !== null;
}

/** Alterna o favorito e retorna o novo estado. */
export async function toggleFavorite(par: string): Promise<boolean> {
  const jaEra = await isFavorite(par);

  if (jaEra) {
    const { error } = await supabase().from(TABLE).delete().eq("par", par);
    if (error) throw new Error(`Falha ao remover favorito de ${par}: ${error.message}`);
    return false;
  }

  const { error } = await supabase().from(TABLE).insert({ par });
  if (error) throw new Error(`Falha ao favoritar ${par}: ${error.message}`);
  return true;
}

export type FavoritePair = {
  par: string;
  tickerA: string;
  tickerB: string;
  zScore: number | null;
  estado: Estado | null;
};

/** Pares favoritados com o status atual (z-score/estado) — usado na
 * sidebar. Lista pequena (curada pelo usuário), então não precisa de
 * paginação como pares_status_atual em geral. */
export async function fetchFavoritesWithStatus(): Promise<FavoritePair[]> {
  const { data: favoritos, error: errFav } = await supabase().from(TABLE).select("par");
  if (errFav) throw new Error(`Falha ao listar favoritos: ${errFav.message}`);
  if (!favoritos || favoritos.length === 0) return [];

  const pares = favoritos.map((f) => f.par as string);
  const { data, error } = await supabase()
    .from("pares_status_atual")
    .select("ticker_a,ticker_b,par,z_score_63d,posicao_aberta")
    .in("par", pares);

  if (error) throw new Error(`Falha ao buscar status dos favoritos: ${error.message}`);

  return (data ?? []).map((r) => ({
    par: r.par,
    tickerA: r.ticker_a,
    tickerB: r.ticker_b,
    zScore: r.z_score_63d,
    estado: estadoFromRow(r.z_score_63d, r.posicao_aberta),
  }));
}
