# Pairs Trading Monitor

Monitoramento de pairs trading para RKLB/PL (espacial) e RPD/TENB (cybersecurity).

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # preencha com suas chaves
```

Rode `sql/schema.sql` uma vez no SQL Editor do Supabase antes da primeira execução.

## Uso

```bash
python run_daily.py        # coleta preços + recalcula z-scores dos dois pares
```

Dashboard: ver [web/README.md](web/README.md) — app Next.js (rodando local com
`npm run dev` ou publicado no Vercel), que substituiu a versão Streamlit.

## Estrutura

- `alpha_vantage_client.py` — cliente da API Alpha Vantage com controle de limite de taxa (25 chamadas/dia)
- `collect_prices.py` — Parte 1: coleta e acumula preços brutos no Supabase (tabela `precos_diarios`)
- `compute_zscore.py` — Parte 2: calcula correlação móvel, spread, z-score e sinais (tabela `pares_zscore`)
- `run_daily.py` — orquestra as duas etapas acima
- `web/` — Parte 4: dashboard Next.js lendo direto do Supabase (ver `web/README.md`)
- `config.py` — parâmetros ajustáveis (pares, janela de 63 dias, thresholds 1.2/0.5)

## Parâmetros

Editáveis em `config.py`: `ROLLING_WINDOW_DAYS` (janela de correlação e do z-score,
padrão 63), `ENTRY_THRESHOLD` (1.2), `EXIT_THRESHOLD` (0.5). Como os preços brutos
ficam salvos, mudar esses parâmetros e re-rodar `compute_zscore.py` recalcula todo
o histórico de sinais sem precisar recoletar preços.
