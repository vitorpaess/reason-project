import json
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests

import config

BASE_URL = "https://www.alphavantage.co/query"
DAILY_LIMIT = 25
SECONDS_BETWEEN_CALLS = 15

# Persiste quantas chamadas já foram feitas hoje, para não estourar o limite
# diário mesmo que o script rode mais de uma vez no mesmo dia.
_RATE_LIMIT_FILE = Path(__file__).parent / "av_rate_limit.json"


class RateLimitExceeded(Exception):
    pass


def _load_counter() -> dict:
    if not _RATE_LIMIT_FILE.exists():
        return {"date": "", "calls": 0}
    try:
        return json.loads(_RATE_LIMIT_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {"date": "", "calls": 0}


def _save_counter(counter: dict) -> None:
    _RATE_LIMIT_FILE.write_text(json.dumps(counter))


def _register_call() -> int:
    today = date.today().isoformat()
    counter = _load_counter()
    if counter.get("date") != today:
        counter = {"date": today, "calls": 0}
    counter["calls"] += 1
    _save_counter(counter)
    return counter["calls"]


def calls_used_today() -> int:
    counter = _load_counter()
    if counter.get("date") != date.today().isoformat():
        return 0
    return counter["calls"]


def fetch_daily_closes(symbol: str, outputsize: str = "compact") -> dict[str, float]:
    """Retorna {data_iso: preco_fechamento} para o símbolo, mais recente incluso.

    Levanta RateLimitExceeded se o limite diário de 25 chamadas já tiver sido
    atingido (contando chamadas feitas por execuções anteriores hoje) ou se a
    própria API sinalizar limite excedido na resposta.
    """
    if calls_used_today() >= DAILY_LIMIT:
        raise RateLimitExceeded(
            f"Limite diário de {DAILY_LIMIT} chamadas à Alpha Vantage já foi "
            f"atingido hoje. Tente novamente amanhã."
        )

    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "outputsize": outputsize,
        "apikey": config.ALPHA_VANTAGE_API_KEY,
    }
    resp = requests.get(BASE_URL, params=params, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    _register_call()

    if "Note" in payload or "Information" in payload:
        msg = payload.get("Note") or payload.get("Information")
        raise RateLimitExceeded(f"Alpha Vantage sinalizou limite de taxa: {msg}")

    series = payload.get("Time Series (Daily)")
    if series is None:
        raise RuntimeError(f"Resposta inesperada da Alpha Vantage para {symbol}: {payload}")

    return {day: float(values["4. close"]) for day, values in series.items()}


def fetch_all(symbols: list[str], outputsize: str = "compact") -> dict[str, dict[str, float]]:
    """Busca fechamentos diários para vários símbolos, espaçando as chamadas.

    Para na primeira ocorrência de limite de taxa e retorna o que já foi
    coletado até então, deixando claro no log quais símbolos ficaram faltando.
    """
    results: dict[str, dict[str, float]] = {}
    for i, symbol in enumerate(symbols):
        if i > 0:
            time.sleep(SECONDS_BETWEEN_CALLS)
        try:
            results[symbol] = fetch_daily_closes(symbol, outputsize=outputsize)
            print(f"[alpha_vantage] {symbol}: {len(results[symbol])} dias coletados "
                  f"({calls_used_today()}/{DAILY_LIMIT} chamadas usadas hoje)")
        except RateLimitExceeded as e:
            faltando = symbols[i:]
            print(f"[alpha_vantage] LIMITE DE TAXA ATINGIDO ao buscar {symbol}: {e}")
            print(f"[alpha_vantage] Símbolos não coletados nesta execução: {faltando}")
            break
    return results
