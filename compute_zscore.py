"""Calcula duas séries de z-score/correlação em paralelo para cada par.

Cálculo 1 (63d, oficial): janela móvel de ROLLING_WINDOW_DAYS dias — é o
único que decide sinais de entrada/saída e alimenta os cards de status do
dashboard. Comportamento idêntico ao que já existia.

Cálculo 2 (expansivo, histórico): usa todos os dias disponíveis desde o
início, sem mínimo de 63 dias — só para o gráfico principal e a tabela de
histórico de oportunidades poderem mostrar dado desde o primeiro dia
coletado. Nunca decide sinal nenhum.

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

    # Correlação: móvel de 63d (oficial) e expansiva (histórico, desde o
    # 2º dia — precisa de pelo menos 2 pontos pra existir correlação).
    df["correlacao_movel_63d"] = (
        df["retorno_a"].rolling(window=window, min_periods=window).corr(df["retorno_b"])
    )
    df["correlacao_expansiva"] = (
        df["retorno_a"].expanding(min_periods=2).corr(df["retorno_b"])
    )

    preco_a_inicial = df["preco_a"].iloc[0]
    preco_b_inicial = df["preco_b"].iloc[0]
    df["spread"] = (df["preco_a"] / preco_a_inicial) - (df["preco_b"] / preco_b_inicial)

    # z-score 63d (oficial): média/desvio do spread na janela móvel.
    media_63d = df["spread"].rolling(window=window, min_periods=window).mean()
    desvio_63d = df["spread"].rolling(window=window, min_periods=window).std()
    df["z_score_63d"] = (df["spread"] - media_63d) / desvio_63d

    # z-score expansivo (histórico): média/desvio usando todos os dias
    # já vistos até aquele ponto, sem "esquecer" dados antigos.
    media_exp = df["spread"].expanding(min_periods=2).mean()
    desvio_exp = df["spread"].expanding(min_periods=2).std()
    df["z_score_expansivo"] = (df["spread"] - media_exp) / desvio_exp

    # Sinais de entrada/saída: SEMPRE a partir do z-score 63d oficial.
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
                "z_score_expansivo": _num_or_none(row["z_score_expansivo"]),
                "correlacao_movel_63d": _num_or_none(row["correlacao_movel_63d"]),
                "correlacao_expansiva": _num_or_none(row["correlacao_expansiva"]),
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
                f"z-score/correlação de {config.ROLLING_WINDOW_DAYS}d (oficiais) ficarão "
                f"com NaN até acumular dias suficientes — a série expansiva já fica "
                f"disponível desde o 2º dia, só pro gráfico/histórico."
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
                f"| z_score_expansivo = {ultimo['z_score_expansivo']:.3f} "
                f"| correlação expansiva = {ultimo['correlacao_expansiva']:.3f} "
                f"| sinal = {ultimo['sinal']}"
            )
        else:
            print(
                f"[compute_zscore] {par}: {len(rows)} linhas atualizadas "
                f"(ainda sem z-score/correlação 63d oficiais válidos)."
            )


if __name__ == "__main__":
    run()
