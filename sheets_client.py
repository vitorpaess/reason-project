"""Lê as duas planilhas do Google Sheets que agora são a fonte de dados do
sistema (substituem a Alpha Vantage por completo — preço e lista de pares).

As duas planilhas estão compartilhadas como "qualquer pessoa com o link",
então o endpoint de export CSV do Google Docs responde sem autenticação —
não precisamos de service account nem de gspread, só requests + pandas.
"""

import io

import pandas as pd
import requests

import config


def _export_csv_url(sheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"


def _fetch_csv(sheet_id: str) -> pd.DataFrame:
    resp = requests.get(_export_csv_url(sheet_id), timeout=60)
    resp.raise_for_status()
    return pd.read_csv(io.StringIO(resp.text))


def fetch_pares() -> pd.DataFrame:
    """Retorna um DataFrame com colunas ticker_a, ticker_b, setor.

    A planilha não tem cabeçalho de coluna consistente (a 2ª coluna vem sem
    nome) — lemos por posição (0, 1, 2), não por nome de coluna.
    """
    df = _fetch_csv(config.PARES_SHEET_ID)
    df = df.iloc[:, [0, 1, 2]]
    df.columns = ["ticker_a", "ticker_b", "setor"]
    for col in df.columns:
        df[col] = df[col].astype(str).str.strip()
    df = df[(df["ticker_a"] != "") & (df["ticker_b"] != "") & (df["setor"] != "")]
    return df.reset_index(drop=True)


def fetch_precos() -> pd.DataFrame:
    """Retorna um DataFrame em formato longo: ticker, data (ISO), preco_fechamento.

    A planilha vem em formato largo (1 coluna por data, 1 linha por ticker);
    células vazias (tickers com histórico mais curto — IPOs recentes) são
    descartadas, nunca viram preço nulo.
    """
    df = _fetch_csv(config.PRECOS_SHEET_ID)
    df = df.rename(columns={df.columns[0]: "ticker"})
    df["ticker"] = df["ticker"].astype(str).str.strip()

    longo = df.melt(id_vars="ticker", var_name="data_bruta", value_name="preco_fechamento")
    longo = longo.dropna(subset=["preco_fechamento"])
    longo = longo[longo["preco_fechamento"].astype(str).str.strip() != ""]

    longo["data"] = pd.to_datetime(
        longo["data_bruta"].astype(str).str.strip(), format="%m/%d/%Y %H:%M:%S"
    ).dt.strftime("%Y-%m-%d")
    longo["preco_fechamento"] = pd.to_numeric(longo["preco_fechamento"], errors="coerce")
    longo = longo.dropna(subset=["preco_fechamento"])

    return longo[["ticker", "data", "preco_fechamento"]].reset_index(drop=True)
