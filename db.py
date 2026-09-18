from functools import lru_cache

from supabase import Client, create_client

import config


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


def upsert_precos(rows: list[dict]) -> None:
    if not rows:
        return
    get_client().table(config.TABLE_PRECOS).upsert(
        rows, on_conflict="ticker,data"
    ).execute()


def fetch_precos(ticker: str) -> list[dict]:
    resp = (
        get_client()
        .table(config.TABLE_PRECOS)
        .select("data,preco_fechamento")
        .eq("ticker", ticker)
        .order("data")
        .execute()
    )
    return resp.data


def upsert_zscores(rows: list[dict]) -> None:
    if not rows:
        return
    get_client().table(config.TABLE_ZSCORE).upsert(
        rows, on_conflict="par,data"
    ).execute()


def fetch_zscores(par: str) -> list[dict]:
    resp = (
        get_client()
        .table(config.TABLE_ZSCORE)
        .select("*")
        .eq("par", par)
        .order("data")
        .execute()
    )
    return resp.data
