# Pairs Trading Monitor — Dashboard

Next.js (App Router) + Tailwind + Recharts. Lê as tabelas `precos_diarios`,
`pares_status`, `pares_config` e `pares_favoritos` do Supabase (populadas
pelos scripts Python na raiz do repo, a partir de duas planilhas do Google
Sheets, exceto `pares_favoritos` que só o app escreve) e renderiza um grid
de todos os pares (quadrado colorido por status, filtro de setor em
destaque + busca/status/ordenação), status/gráfico/histórico de sinais por
par individual, e uma sidebar com os pares favoritados (botão de coração na
página do par) — o histórico completo de cada par é recalculado sob demanda
(`lib/zscore-calc.ts`), não vem pré-computado do Supabase (ver "Escala" no
README da raiz do repo).

A secret key do Supabase só é usada em código server-side (Server
Components / Route Handlers) — nunca chega ao navegador.

## Rodando localmente

```bash
cd web
npm install
cp .env.example .env.local   # preencha SUPABASE_URL, SUPABASE_KEY, DASHBOARD_PASSWORD
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
4. Deploy. Todo push em `main` gera um novo deploy automaticamente.

As páginas (`/dashboard`, `/pair/[pair]`) são renderizadas por requisição
(`export const dynamic = "force-dynamic"`), então sempre refletem o que a
rotina agendada gravou no Supabase no último dia útil — nunca ficam
congeladas num build antigo.

## Estrutura

- `proxy.ts` — protege todas as rotas com senha (cookie httpOnly), exceto `/login`.
- `app/(app)/dashboard/page.tsx` — grid de todos os pares (quadrado por par: ticker, z-score, cor de status), com filtro de setor em destaque no topo + busca/status/ordenação (server-side, via `lib/pares-repo.ts`, paginado). É a tela inicial pra navegar entre os ~7,9 mil pares.
- `app/(app)/pair/[pair]/page.tsx` — status, gráfico e histórico do par selecionado; botão de coração (`components/HeartButton.tsx`) pra favoritar.
- `lib/pares-repo.ts` — lê `pares_config`/a view `pares_status_atual` no Supabase (status mais recente de cada par); substitui o antigo array estático de pares (inviável na escala atual).
- `lib/favorites-repo.ts` — pares favoritados (`pares_favoritos`), usados só pra montar a sidebar esquerda — a lista completa de pares não escala ali.
- `lib/zscore-calc.ts` — porta em TypeScript do cálculo de z-score/correlação de `compute_zscore.py`, computado sob demanda a partir do preço bruto (não lido de uma tabela pré-calculada).
- `lib/pairs-data.ts` — lógica de estado (aberta/saída/espera) e histórico de oportunidades, aplicada sobre a série calculada por `zscore-calc.ts`.
- `lib/theme.ts` — mesma paleta validada (contraste/CVD) do dashboard Python.
- `lib/company-prices.ts` / `components/CompanyPriceChart.tsx` — gráfico de preço bruto de cada ticker de um par (sem dado de empresa curado — só o preço que já vem da planilha).
