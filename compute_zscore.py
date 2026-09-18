"""Calcula z-score, correlação móvel e sinais de entrada/saída para cada par.

Lê os preços brutos já salvos no Supabase (nunca recalcula os preços), e
recalcula a tabela derivada pares_zscore inteira a cada execução — isso é
intencional: como é uma tabela derivada (não dado bruto), recalculá-la do
zero a partir dos preços é barato e garante que mudanças de parâmetro
(threshold, janela) fiquem consistentes em todo o histórico.
"""

import math

import pandas as pd

import config
import db


def _load_pair_frame(ticker_a: str, ticker_b: str) -> pd.DataFrame:
    precos_a = pd.DataFrame(db.fetch_precos(ticker_a))
    precos_b = pd.DataFrame(db.fetch_precos(ticker_b))

    if precos_a.empty or precos_b.empty:
        return pd.DataFrame()

    precos_a = precos_a.rename(columns={"preco_fechamento": "preco_a"})
    precos_b = precos_b.rename(columns={"preco_fechamento": "preco_b"})

    df = pd.merge(precos_a, precos_b, on="data", how="inner").sort_values("data")
    df["data"] = pd.to_datetime(df["data"])
    df = df.reset_index(drop=True)
    return df


def _compute_signals(df: pd.DataFrame, ticker_a: str, ticker_b: str) -> pd.DataFrame:
    window = config.ROLLING_WINDOW_DAYS

    df["retorno_a"] = df["preco_a"].pct_change()
    df["retorno_b"] = df["preco_b"].pct_change()
    df["correlacao_movel_63d"] = (
        df["retorno_a"].rolling(window=window, min_periods=window).corr(df["retorno_b"])
    )

    preco_a_inicial = df["preco_a"].iloc[0]
    preco_b_inicial = df["preco_b"].iloc[0]
    df["spread"] = (df["preco_a"] / preco_a_inicial) - (df["preco_b"] / preco_b_inicial)

    media_spread = df["spread"].rolling(window=window, min_periods=window).mean()
    desvio_spread = df["spread"].rolling(window=window, min_periods=window).std()
    df["z_score"] = (df["spread"] - media_spread) / desvio_spread

    sinais = []
    direcoes = []
    state = "flat"
    for z in df["z_score"]:
        if z is None or (isinstance(z, float) and math.isnan(z)):
            sinais.append("nenhum")
            direcoes.append(None)
            continue

        if state == "flat" and abs(z) > config.ENTRY_THRESHOLD:
            state = "aberta"
            sinais.append("entrada")
            if z > 0:
                direcoes.append(f"vender {ticker_a} / comprar {ticker_b}")
            else:
                direcoes.append(f"comprar {ticker_a} / vender {ticker_b}")
        elif state == "aberta" and abs(z) < config.EXIT_THRESHOLD:
            state = "flat"
            sinais.append("saida")
            direcoes.append(None)
        else:
            sinais.append("nenhum")
            direcoes.append(None)

    df["sinal"] = sinais
    df["direcao"] = direcoes
    return df


def _to_rows(df: pd.DataFrame, par: str) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        rows.append(
            {
                "par": par,
                "data": row["data"].date().isoformat(),
                "z_score": None if pd.isna(row["z_score"]) else float(row["z_score"]),
                "correlacao_movel_63d": None
                if pd.isna(row["correlacao_movel_63d"])
                else float(row["correlacao_movel_63d"]),
                "spread": None if pd.isna(row["spread"]) else float(row["spread"]),
                "sinal": row["sinal"],
                "direcao": row["direcao"],
            }
        )
    return rows


def run() -> None:
    for ticker_a, ticker_b in config.PAIRS:
        par = f"{ticker_a}/{ticker_b}"
        df = _load_pair_frame(ticker_a, ticker_b)

        if df.empty:
            print(f"[compute_zscore] {par}: sem dados suficientes ainda (preços não coletados).")
            continue

        if len(df) < config.MIN_HISTORY_DAYS:
            print(
                f"[compute_zscore] AVISO: {par} tem apenas {len(df)} dias de histórico "
                f"comum entre as duas ações (mínimo recomendado: {config.MIN_HISTORY_DAYS}). "
                f"z-score e correlação móvel de {config.ROLLING_WINDOW_DAYS}d ficarão "
                f"com NaN até acumular dias suficientes."
            )

        df = _compute_signals(df, ticker_a, ticker_b)
        rows = _to_rows(df, par)
        db.upsert_zscores(rows)

        ultimo = df.iloc[-1]
        print(
            f"[compute_zscore] {par}: {len(rows)} linhas atualizadas. "
            f"z_score mais recente = {ultimo['z_score']:.3f} "
            f"| correlação 63d = {ultimo['correlacao_movel_63d']:.3f} "
            f"| sinal = {ultimo['sinal']}"
            if not pd.isna(ultimo["z_score"]) and not pd.isna(ultimo["correlacao_movel_63d"])
            else f"[compute_zscore] {par}: {len(rows)} linhas atualizadas (ainda sem z-score/correlação válidos)."
        )


if __name__ == "__main__":
    run()
