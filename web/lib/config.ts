// Espelha config.py — mesmos parâmetros usados no cálculo Python. A lista
// de pares não vive mais aqui como array estático: agora é dado, sincronizado
// da planilha "Pares DATA" para a tabela pares_config no Supabase (ver
// lib/pares-repo.ts).

export type PairDef = { slug: string; label: string; a: string; b: string };

export const ENTRY_THRESHOLD = 1.2;
export const EXIT_THRESHOLD = 0.5;
export const ROLLING_WINDOW_DAYS = 63;
