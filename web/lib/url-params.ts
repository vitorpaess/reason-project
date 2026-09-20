// Helper puro (sem "server-only") pra montar querystring mesclando os
// parâmetros atuais com overrides — usado tanto em componentes de servidor
// (links de ordenação/paginação) quanto no client component de busca/filtro.

export function buildQuery(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
