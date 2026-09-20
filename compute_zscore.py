"""Calcula z-score, correlação móvel e sinal de entrada/saída para cada par.

Um único cálculo: janela móvel de ROLLING_WINDOW_DAYS dias com aquecimento
adaptativo (min_periods baixo). Do 2º dia até o dia ROLLING_WINDOW_DAYS-1,
usa todos os dados disponíveis até aquele ponto (a janela do pandas cresce
sozinha); a partir do dia ROLLING_WINDOW_DAYS, vira uma janela móvel real
dos últimos N dias, esquecendo dados mais antigos normalmente.

Sempre recalcula a série INTEIRA a partir do preço bruto (o sinal de hoje
depende do estado acumulado — se já tinha uma posição sinalizada aberta —
então precisa da série completa, não só do dia mais recente), mas só
PERSISTE a última linha de cada par em pares_status (1 linha por par,
upsert por chave primária `par`, nunca cresce). O histórico completo pra
gráfico/tabela de oportunidades é recalculado sob demanda no Next.js
(TypeScript), a partir do mesmo preço bruto (precos_diarios) — guardar o
histórico calculado dos ~7,9 mil pares aqui já estourou o armazenamento do
projeto numa versão anterior.

Carrega o preço de TODOS os tickers do Supabase uma vez só no início (não
1 fetch por ticker por par) — com ~660 tickers compartilhados entre ~7.9k
pares, buscar por par duplicaria fetches do mesmo ticker dezenas de vezes.
"""

import math

import pandas as pd

import config
import db


def _carregar_precos_por_ticker() -> dict[str, pd.DataFrame]:
    linhas = db.fetch_todos_precos()
    df = pd.DataFrame(linhas)
    if df.empty:
        return {}
    return {ticker: grupo.reset_index(drop=True) for ticker, grupo in df.groupby("ticker")}


def _load_pair_frame(
    precos_por_ticker: dict[str, pd.DataFrame], ticker_a: str, ticker_b: str
) -> pd.DataFrame:
    precos_a = precos_por_ticker.get(ticker_a)
    precos_b = precos_por_ticker.get(ticker_b)

    if precos_a is None or precos_b is None or precos_a.empty or precos_b.empty:
        return pd.DataFrame()

    precos_a = precos_a.rename(columns={"preco_fechamento": "preco_a"})[["data", "preco_a"]]
    precos_b = precos_b.rename(columns={"preco_fechamento": "preco_b"})[["data", "preco_b"]]

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


def _ultima_linha_como_status(df: pd.DataFrame, par: str) -> dict:
    ultimo = df.iloc[-1]
    return {
        "par": par,
        "data": ultimo["data"].date().isoformat(),
        "z_score_63d": _num_or_none(ultimo["z_score_63d"]),
        "correlacao_movel_63d": _num_or_none(ultimo["correlacao_movel_63d"]),
        "spread": _num_or_none(ultimo["spread"]),
        "sinal": ultimo["sinal"],
        "direcao": ultimo["direcao"],
    }


def run() -> None:
    pares = db.fetch_pares_config()
    if not pares:
        print("[compute_zscore] pares_config está vazia — rode collect_prices.py antes.")
        return

    print("[compute_zscore] Carregando preço de todos os tickers (uma vez)...")
    precos_por_ticker = _carregar_precos_por_ticker()
    print(f"[compute_zscore] {len(precos_por_ticker)} tickers com preço carregado em memória.")

    status_rows: list[dict] = []
    sem_dados = 0
    historico_curto = 0
    sinais_hoje: list[str] = []

    for i, par_def in enumerate(pares, start=1):
        if i % 1000 == 0:
            print(f"[compute_zscore] progresso: {i}/{len(pares)} pares calculados...")

        ticker_a, ticker_b = par_def["ticker_a"], par_def["ticker_b"]
        par = f"{ticker_a}/{ticker_b}"

        df = _load_pair_frame(precos_por_ticker, ticker_a, ticker_b)
        if df.empty:
            sem_dados += 1
            continue
        if len(df) < config.MIN_HISTORY_DAYS:
            historico_curto += 1

        df = _compute_signals(df, ticker_a, ticker_b)
        status = _ultima_linha_como_status(df, par)
        status_rows.append(status)

        if status["sinal"] in ("entrada", "saida") and status["z_score_63d"] is not None:
            sinais_hoje.append(f"{par}: {status['sinal']} (z={status['z_score_63d']:.2f})")

    print(f"[compute_zscore] Fazendo upsert de {len(status_rows)} linhas em pares_status...")
    db.upsert_pares_status(status_rows)

    print(
        f"[compute_zscore] Concluído: {len(pares)} pares processados "
        f"({sem_dados} sem dado de preço comum, {historico_curto} com histórico < "
        f"{config.MIN_HISTORY_DAYS} dias)."
    )
    if sinais_hoje:
        print(f"[compute_zscore] {len(sinais_hoje)} sinal(is) de entrada/saída no último dia:")
        for linha in sinais_hoje:
            print(f"  - {linha}")
    else:
        print("[compute_zscore] Nenhum sinal de entrada/saída novo no último dia.")


if __name__ == "__main__":
    run()
