"""Sincroniza a lista de pares e os preços diários a partir das planilhas do
Google Sheets ("Pares DATA" e "Preços DATA") — substitui por completo a
coleta via Alpha Vantage.

As duas planilhas são a fonte de verdade, buscadas inteiras a cada execução.
precos_diarios recebe upsert (idempotente, por ticker+data — nunca perde
histórico). pares_config é SUBSTITUÍDA inteira pelo conteúdo atual da
planilha (apaga tudo e reinsere) — assim, um par removido da planilha some
do sistema na próxima execução, em vez de ficar órfão pra sempre (upsert
sozinho nunca deletaria). Sem limite de taxa de API nem conceito de
"backfill vs. incremental" — o CSV inteiro é pequeno o bastante (poucos MB)
pra buscar e reenviar sempre inteiro.
"""

import pandas as pd

import db
import sheets_client


def run() -> None:
    print("[collect_prices] Buscando planilha de pares...")
    pares_df = sheets_client.fetch_pares()
    pares_rows = pares_df.to_dict(orient="records")
    db.sync_pares_config(pares_rows)
    tickers_unicos = pd.concat([pares_df["ticker_a"], pares_df["ticker_b"]]).nunique()
    print(
        f"[collect_prices] pares_config: sincronizado com {len(pares_rows)} pares da planilha "
        f"({tickers_unicos} tickers únicos) — pares removidos da planilha também são removidos daqui"
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
