# Pairs Trading Monitor — Dashboard

Next.js (App Router) + Tailwind + Recharts. Lê as tabelas `precos_diarios` e
`pares_zscore` do Supabase (populadas pelos scripts Python na raiz do repo)
e renderiza status, gráfico de z-score e histórico de sinais por par.

A secret key do Supabase só é usada em código server-side (Server
Components / Route Handlers) — nunca chega ao navegador.

## Rodando localmente

```bash
cd web
npm install
cp .env.example .env.local   # preencha SUPABASE_URL, SUPABASE_KEY, DASHBOARD_PASSWORD, LOGO_DEV_PUBLISHABLE_KEY
npm run dev
```

Abra http://localhost:3000 — vai pedir a senha definida em `DASHBOARD_PASSWORD`.

## Deploy no Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importar o repositório GitHub `vitorpaess/reason-project`.
2. Em **Root Directory**, selecione `web`.
3. Em **Environment Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `DASHBOARD_PASSWORD`
   - `LOGO_DEV_PUBLISHABLE_KEY`
4. Deploy. Todo push em `main` gera um novo deploy automaticamente.

As páginas de par (`/pair/[pair]`) são renderizadas por requisição
(`export const dynamic = "force-dynamic"`), então sempre refletem o que a
rotina agendada gravou no Supabase no último dia útil — nunca ficam
congeladas num build antigo.

## Estrutura

- `proxy.ts` — protege todas as rotas com senha (cookie httpOnly), exceto `/login`.
- `app/pair/layout.tsx` — busca o status dos dois pares e renderiza a sidebar.
- `app/pair/[pair]/page.tsx` — status, gráfico e histórico do par selecionado.
- `lib/pairs-data.ts` — porta em TypeScript da lógica de estado (aberta/saída/espera) do `compute_zscore.py`, aplicada sobre os dados já calculados no Supabase (não recalcula z-score, só interpreta o que já está salvo).
- `lib/theme.ts` — mesma paleta validada (contraste/CVD) do dashboard Python.
- `lib/companies.ts` / `lib/logo.ts` — dados básicos e logo (via [logo.dev](https://logo.dev)) das empresas de cada par, mostrados no painel à direita (`CompanySidebar`).
