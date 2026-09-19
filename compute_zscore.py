"""Calcula z-score, correlação móvel e sinais de entrada/saída para cada par.

Um único cálculo: janela móvel de ROLLING_WINDOW_DAYS dias com aquecimento
adaptativo (min_periods baixo). Do 2º dia até o dia ROLLING_WINDOW_DAYS-1,
usa todos os dados disponíveis até aquele ponto (a janela do pandas cresce
sozinha); a partir do dia ROLLING_WINDOW_DAYS, vira uma janela móvel real
dos últimos N dias, esquecendo dados mais antigos normalmente. Não existe
mais uma série "expansiva" separada — é a mesma coluna o tempo todo, só
com amostra menor (e por isso mais ruidosa) nos primeiros dias.

Essa única série decide sinais de entrada/saída e alimenta tanto os cards
de status quanto o gráfico e a tabela de histórico de oportunidades.

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

    # min_periods=2 é o mínimo matemático (desvio-padrão/correlação exigem
    # pelo menos 2 pontos) — com isso, rolling(window=63) já faz o
    # aquecimento adaptativo sozinho: usa 2, 3, 4... observações nos
    # primeiros dias e trava em exatamente 63 a partir do dia 63.
    MIN_PERIODS = 2

    df["retorno_a"] = df["preco_a"].pct_change()
    df["retorno_b"] = df["preco_b"].pct_change()
    df["correlacao_movel_63d"] = (
        df["retorno_a"].rolling(window=window, min_periods=MIN_PERIODS).corr(df["retorno_b"])
    )

    preco_a_inicial = df["preco_a"].iloc[0]
    preco_b_inicial = df["preco_b"].iloc[0]
    df["spread"] = (df["preco_a"] / preco_a_inicial) - (df["preco_b"] / preco_b_inicial)

    media_63d = df["spread"].rolling(window=window, min_periods=MIN_PERIODS).mean()
    desvio_63d = df["spread"].rolling(window=window, min_periods=MIN_PERIODS).std()
    df["z_score_63d"] = (df["spread"] - media_63d) / desvio_63d

    sinais = []
    direcoes = []
    state = "flat"
    for z in df["z_score_63d"]:
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


def _num_or_none(value):
    return None if pd.isna(value) else float(value)


def _to_rows(df: pd.DataFrame, par: str) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        rows.append(
            {
                "par": par,
                "data": row["data"].date().isoformat(),
                "z_score_63d": _num_or_none(row["z_score_63d"]),
                "correlacao_movel_63d": _num_or_none(row["correlacao_movel_63d"]),
                "spread": _num_or_none(row["spread"]),
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
                f"Até completar {config.ROLLING_WINDOW_DAYS} dias, o z-score/correlação usam "
                f"uma amostra menor que a janela cheia — ficam mais ruidosos, não NaN."
            )

        df = _compute_signals(df, ticker_a, ticker_b)
        rows = _to_rows(df, par)
        db.upsert_zscores(rows)

        ultimo = df.iloc[-1]
        if not pd.isna(ultimo["z_score_63d"]) and not pd.isna(ultimo["correlacao_movel_63d"]):
            print(
                f"[compute_zscore] {par}: {len(rows)} linhas atualizadas. "
                f"z_score_63d mais recente = {ultimo['z_score_63d']:.3f} "
                f"| correlação 63d = {ultimo['correlacao_movel_63d']:.3f} "
                f"| sinal = {ultimo['sinal']}"
            )
        else:
            print(
                f"[compute_zscore] {par}: {len(rows)} linhas atualizadas "
                f"(ainda sem z-score/correlação 63d válidos)."
            )


if __name__ == "__main__":
    run()
