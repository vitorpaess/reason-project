import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client server-only: usa a secret key do Supabase, que nunca pode chegar
// ao navegador. O import "server-only" faz o build falhar se este módulo
// for importado por engano num Client Component.

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada.`);
  }
  return value;
}

// Sem schema gerado do Supabase: usamos o client tipado como `any` de
// propósito (createClient<any>) — sem isso, alguns métodos (insert/update)
// resolvem o tipo da linha como `never` em vez de aceitar o payload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createClient<any>> | null = null;

export function supabase() {
  if (!_client) {
    const url = requiredEnv("SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
    const key = requiredEnv("SUPABASE_KEY");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _client = createClient<any>(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
