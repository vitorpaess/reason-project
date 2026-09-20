import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

import config

# Tamanho de lote pro upsert grande de precos_diarios (pode chegar a ~700k
# linhas) — mantém cada requisição HTTP num tamanho razoável. 2000 estourou
# o statement_timeout do Supabase num upsert com ON CONFLICT contra uma
# tabela grande; 300 se mostrou seguro.
_CHUNK_SIZE = 300
_PAGE_SIZE = 1000  # também o teto padrão do PostgREST por requisição
_WORKERS = 4  # paralelismo pros lotes de leitura/escrita
_RETRIES = 3


def _chunked(rows: list[dict], size: int = _CHUNK_SIZE):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


def _novo_client() -> Client:
    """Cliente próprio (não o singleton cacheado) — usado dentro de threads
    de um pool, pra cada uma ter sua própria conexão em vez de compartilhar
    uma só entre threads concorrentes (foi a causa de um RemoteProtocolError
    HTTP/2 com o client compartilhado sob concorrência)."""
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


def _com_retry(fn, tentativas: int = _RETRIES):
    ultimo_erro = None
    for tentativa in range(tentativas):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — erro transiente de rede/protocolo, tenta de novo
            ultimo_erro = e
            if tentativa < tentativas - 1:
                time.sleep(1.5 * (tentativa + 1))
    raise ultimo_erro


def _upsert_paralelo(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    lotes = list(_chunked(rows))

    def _enviar(lote: list[dict]) -> None:
        client = _novo_client()
        _com_retry(lambda: client.table(table).upsert(lote, on_conflict=on_conflict).execute())

    with ThreadPoolExecutor(max_workers=_WORKERS) as executor:
        list(executor.map(_enviar, lotes))


def upsert_precos(rows: list[dict]) -> None:
    _upsert_paralelo(config.TABLE_PRECOS, rows, "ticker,data")


def upsert_pares_config(rows: list[dict]) -> None:
    """rows: [{ticker_a, ticker_b, setor}, ...]"""
    _upsert_paralelo(config.TABLE_PARES_CONFIG, rows, "ticker_a,ticker_b")


def upsert_pares_status(rows: list[dict]) -> None:
    """rows: 1 dict por par (última linha calculada) — upsert por chave
    primária `par`, então a tabela nunca cresce além do total de pares."""
    _upsert_paralelo(config.TABLE_PARES_STATUS, rows, "par")


def _fetch_paginado_paralelo(
    table: str, select: str, order_by: Optional[list[str]] = None
) -> list[dict]:
    """Busca uma tabela inteira em paralelo: 1a chamada pega a contagem total,
    depois todas as páginas são buscadas de uma vez via thread pool — bem
    mais rápido que paginar sequencialmente quando a tabela tem centenas de
    milhares de linhas (precos_diarios) ou milhares de linhas (pares_config)."""

    def _query(client: Client):
        q = client.table(table).select(select, count="exact")
        for col in order_by or []:
            q = q.order(col)
        return q

    primeira = _com_retry(lambda: _query(get_client()).range(0, _PAGE_SIZE - 1).execute())
    total = primeira.count or 0
    paginas = [primeira.data]

    offsets = list(range(_PAGE_SIZE, total, _PAGE_SIZE))
    if offsets:
        def _buscar_pagina(offset: int) -> list[dict]:
            client = _novo_client()
            resp = _com_retry(lambda: _query(client).range(offset, offset + _PAGE_SIZE - 1).execute())
            return resp.data

        with ThreadPoolExecutor(max_workers=_WORKERS) as executor:
            paginas.extend(executor.map(_buscar_pagina, offsets))

    todas: list[dict] = []
    for pagina in paginas:
        todas.extend(pagina)
    return todas


def fetch_pares_config() -> list[dict]:
    return _fetch_paginado_paralelo(config.TABLE_PARES_CONFIG, "ticker_a,ticker_b,setor")


def fetch_todos_precos() -> list[dict]:
    """Todo o histórico de preço de todos os tickers, numa passada só — usado
    pelo compute_zscore.py pra não refazer 1 fetch por ticker por par (um
    ticker pode aparecer em várias dezenas de pares)."""
    return _fetch_paginado_paralelo(
        config.TABLE_PRECOS, "ticker,data,preco_fechamento", order_by=["ticker", "data"]
    )


