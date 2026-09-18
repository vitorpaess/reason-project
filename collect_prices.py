"""Coleta os fechamentos diários dos tickers monitorados e acumula no Supabase.

Sempre busca outputsize=compact (~100 últimos dias) e faz upsert por
(ticker, data). Isso serve tanto para o backfill inicial (tabela vazia)
quanto para as execuções diárias seguintes: como o upsert é idempotente e
nunca apaga dados fora da janela dos 100 dias, o histórico só cresce
(nunca é recalculado do zero). Custa 1 chamada de API por ticker, sempre.
"""

from datetime import date

import config
import db
from alpha_vantage_client import fetch_all


def run() -> None:
    print(f"[collect_prices] Coletando {config.TICKERS} em {date.today().isoformat()}")

    existing_counts = {t: len(db.fetch_precos(t)) for t in config.TICKERS}
    is_first_run = all(count == 0 for count in existing_counts.values())
    if is_first_run:
        print("[collect_prices] Tabela vazia — este é o backfill inicial (outputsize=compact, ~100 dias).")

    all_closes = fetch_all(config.TICKERS, outputsize="compact")

    for ticker, closes in all_closes.items():
        rows = [
            {"ticker": ticker, "data": day, "preco_fechamento": price}
            for day, price in closes.items()
        ]
        db.upsert_precos(rows)
        print(f"[collect_prices] {ticker}: upsert de {len(rows)} linhas concluído")

        total_dias = len(db.fetch_precos(ticker))
        if total_dias < config.MIN_HISTORY_DAYS:
            print(
                f"[collect_prices] AVISO: {ticker} tem apenas {total_dias} dias de "
                f"histórico no banco (mínimo recomendado: {config.MIN_HISTORY_DAYS}). "
                f"Correlação/z-score podem ficar pouco confiáveis até acumular mais dias. "
                f"O plano gratuito da Alpha Vantage só permite outputsize=compact "
                f"(~100 dias); outputsize=full exige plano pago."
            )

    coletados = set(all_closes.keys())
    faltando = set(config.TICKERS) - coletados
    if faltando:
        print(f"[collect_prices] Tickers não coletados nesta execução (limite de taxa): {sorted(faltando)}")


if __name__ == "__main__":
    run()
