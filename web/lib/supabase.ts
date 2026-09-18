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

let _client: ReturnType<typeof createClient> | null = null;

export function supabase() {
  if (!_client) {
    const url = requiredEnv("SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
    const key = requiredEnv("SUPABASE_KEY");
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
