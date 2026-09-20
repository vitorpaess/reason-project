# Pairs Trading Monitor

Monitoramento de pairs trading para milhares de pares, definidos e mantidos numa
planilha do Google Sheets (não mais hardcoded no código) — ver "Fonte de dados"
abaixo.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # preencha SUPABASE_URL e SUPABASE_KEY
```

Rode `sql/schema.sql` uma vez no SQL Editor do Supabase antes da primeira execução.

## Fonte de dados

Duas planilhas do Google Sheets, compartilhadas como "qualquer pessoa com o link"
(lidas via export CSV público — sem credencial nenhuma, ver `sheets_client.py`):

- **Pares** (`config.PARES_SHEET_ID`): ticker A, ticker B, setor — um par por linha.
- **Preços** (`config.PRECOS_SHEET_ID`): fechamento diário por ticker, formato largo
  (1 coluna por data), atualizada diariamente por fora deste sistema.

`collect_prices.py` sincroniza as duas pra `pares_config` e `precos_diarios` no
Supabase a cada execução — não existe mais coleta via API de mercado nem limite de
taxa.

## Uso

```bash
python run_daily.py    # sincroniza planilhas + recalcula o status de cada par
```

Dashboard: ver [web/README.md](web/README.md) — app Next.js (rodando local com
`npm run dev` ou publicado no Vercel), que substituiu a versão Streamlit.

## Estrutura

- `sheets_client.py` — lê as duas planilhas do Google Sheets (export CSV público)
- `collect_prices.py` — sincroniza `pares_config` (lista de pares/setor) e `precos_diarios` (preço bruto) a partir das planilhas
- `compute_zscore.py` — calcula correlação móvel, spread, z-score e sinal de entrada/saída pra cada par, persistindo só a última linha calculada (tabela `pares_status`); carrega o preço de todos os tickers uma vez só, não por par
- `run_daily.py` — orquestra as duas etapas acima
- `web/` — dashboard Next.js lendo direto do Supabase (ver `web/README.md`)
- `config.py` — parâmetros ajustáveis (janela de 63 dias, thresholds 1.2/0.5)

## Parâmetros

Editáveis em `config.py`: `ROLLING_WINDOW_DAYS` (janela de correlação e do z-score,
padrão 63), `ENTRY_THRESHOLD` (1.2), `EXIT_THRESHOLD` (0.5). Como os preços brutos
ficam salvos completos, mudar esses parâmetros e rodar `python run_daily.py` de novo
já recalcula tudo — inclusive o histórico exibido no dashboard, que é recalculado sob
demanda (não fica pré-computado, ver seção "Escala").

## Escala

Com ~7,9 mil pares (~660 tickers únicos), guardar o z-score/correlação calculado de
TODOS os dias de TODOS os pares chegaria a dezenas de milhões de linhas — isso já
estourou o armazenamento do projeto numa versão anterior. A solução: `pares_status`
guarda só a última linha calculada de cada par (~7,9 mil linhas, nunca cresce), usada
pela tabela do dashboard. O histórico completo de um par específico (gráfico,
histórico de oportunidades) é recalculado sob demanda no próprio Next.js
(`web/lib/zscore-calc.ts`, porta em TypeScript do mesmo cálculo deste `compute_zscore.py`),
a partir do preço bruto em `precos_diarios` — que continua completo e é barato de
guardar (~680 mil linhas pros ~660 tickers × ~5 anos).
