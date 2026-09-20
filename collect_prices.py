"""Sincroniza a lista de pares e os preços diários a partir das planilhas do
Google Sheets ("Pares DATA" e "Preços DATA") — substitui por completo a
coleta via Alpha Vantage.

As duas planilhas são a fonte de verdade: toda execução busca o conteúdo
inteiro de cada uma e faz upsert (idempotente, por chave única) em
pares_config e precos_diarios. Não existe mais limite de taxa nem conceito
de "backfill vs. incremental" na coleta em si — o CSV inteiro é pequeno o
bastante (poucos MB) pra buscar e reenviar sempre inteiro; só o cálculo do
z-score (compute_zscore.py) que distingue backfill de rodada diária, na
hora de decidir quanto persistir.
"""

import pandas as pd

import db
import sheets_client


def run() -> None:
    print("[collect_prices] Buscando planilha de pares...")
    pares_df = sheets_client.fetch_pares()
    pares_rows = pares_df.to_dict(orient="records")
    db.upsert_pares_config(pares_rows)
    tickers_unicos = pd.concat([pares_df["ticker_a"], pares_df["ticker_b"]]).nunique()
    print(
        f"[collect_prices] pares_config: upsert de {len(pares_rows)} pares concluído "
        f"({tickers_unicos} tickers únicos)"
    )

    print("[collect_prices] Buscando planilha de preços...")
    precos_df = sheets_client.fetch_precos()
    precos_rows = precos_df.to_dict(orient="records")
    db.upsert_precos(precos_rows)
    print(
        f"[collect_prices] precos_diarios: upsert de {len(precos_rows)} linhas concluído "
        f"({precos_df['ticker'].nunique()} tickers, "
        f"{precos_df['data'].min()} a {precos_df['data'].max()})"
    )


if __name__ == "__main__":
    run()
