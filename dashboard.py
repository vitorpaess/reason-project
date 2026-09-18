"""Dashboard local (Streamlit) do sistema de pairs trading.

Lê diretamente do Supabase (tabelas precos_diarios e pares_zscore) — não
recalcula nada, só visualiza o que collect_prices.py / compute_zscore.py
já salvaram. Rode com: streamlit run dashboard.py
"""

from datetime import date

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import config
import db

st.set_page_config(page_title="Pairs Trading Monitor", layout="wide")
st.title("Pairs Trading Monitor")


@st.cache_data(ttl=300)
def load_zscore_df(par: str) -> pd.DataFrame:
    rows = db.fetch_zscores(par)
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["data"] = pd.to_datetime(df["data"])
    return df.sort_values("data").reset_index(drop=True)


def build_signal_history(df: pd.DataFrame) -> pd.DataFrame:
    """Reconstrói pares entrada/saída a partir da coluna 'sinal'."""
    eventos = df[df["sinal"].isin(["entrada", "saida"])].reset_index(drop=True)
    historico = []
    entrada_atual = None

    for _, row in eventos.iterrows():
        if row["sinal"] == "entrada":
            entrada_atual = row
        elif row["sinal"] == "saida" and entrada_atual is not None:
            dias_aberto = (row["data"] - entrada_atual["data"]).days
            historico.append(
                {
                    "data_entrada": entrada_atual["data"].date(),
                    "z_entrada": round(entrada_atual["z_score"], 3),
                    "direcao": entrada_atual["direcao"],
                    "data_saida": row["data"].date(),
                    "z_saida": round(row["z_score"], 3),
                    "dias_em_aberto": dias_aberto,
                }
            )
            entrada_atual = None

    # posição ainda aberta (entrada sem saída correspondente)
    if entrada_atual is not None:
        dias_aberto = (date.today() - entrada_atual["data"].date()).days
        historico.append(
            {
                "data_entrada": entrada_atual["data"].date(),
                "z_entrada": round(entrada_atual["z_score"], 3),
                "direcao": entrada_atual["direcao"],
                "data_saida": None,
                "z_saida": None,
                "dias_em_aberto": dias_aberto,
            }
        )

    return pd.DataFrame(historico[::-1])  # mais recente primeiro


def render_pair(par: str) -> None:
    st.header(par)
    df = load_zscore_df(par)

    if df.empty:
        st.info("Ainda não há dados calculados para este par. Rode collect_prices.py e compute_zscore.py.")
        return

    df_valido = df.dropna(subset=["z_score"])
    if df_valido.empty:
        st.warning(
            f"Histórico insuficiente ainda para calcular z-score/correlação "
            f"(janela de {config.ROLLING_WINDOW_DAYS} dias). Aguarde mais coletas diárias."
        )
        return

    ultimo = df_valido.iloc[-1]

    # --- Status atual ---
    historico = build_signal_history(df)
    posicao_aberta = not historico.empty and historico.iloc[0]["data_saida"] is None

    col1, col2, col3 = st.columns(3)
    with col1:
        if posicao_aberta:
            entrada = historico.iloc[0]
            st.metric(
                "Status",
                "Posição aberta",
                f"desde {entrada['data_entrada']} ({entrada['dias_em_aberto']}d) — {entrada['direcao']}",
            )
        elif ultimo["sinal"] == "entrada" and ultimo["data"].date() == date.today():
            st.metric("Status", "Sinal de entrada disparado hoje", ultimo["direcao"])
        else:
            st.metric("Status", "Sem sinal")
    with col2:
        st.metric("Z-score atual", f"{ultimo['z_score']:.2f}")
    with col3:
        corr = ultimo["correlacao_movel_63d"]
        st.metric(
            f"Correlação móvel {config.ROLLING_WINDOW_DAYS}d",
            f"{corr:.2f}" if pd.notna(corr) else "N/D",
        )
        if pd.notna(corr) and abs(corr) < 0.5:
            st.caption("Correlação baixa — par pode estar perdendo a relação estatística.")

    # --- Gráfico de z-score ---
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df_valido["data"], y=df_valido["z_score"], mode="lines", name="z-score"))
    for limite, cor, label in [
        (config.ENTRY_THRESHOLD, "red", "entrada +"),
        (-config.ENTRY_THRESHOLD, "red", "entrada -"),
        (config.EXIT_THRESHOLD, "green", "saída +"),
        (-config.EXIT_THRESHOLD, "green", "saída -"),
    ]:
        fig.add_hline(y=limite, line_dash="dash", line_color=cor, annotation_text=label)
    fig.update_layout(height=400, margin=dict(t=20, b=20), yaxis_title="z-score")
    st.plotly_chart(fig, width="stretch")

    # --- Histórico de sinais ---
    st.subheader("Histórico de sinais")
    if historico.empty:
        st.caption("Nenhum sinal de entrada/saída disparado ainda.")
    else:
        st.dataframe(historico, width="stretch", hide_index=True)


for ticker_a, ticker_b in config.PAIRS:
    render_pair(f"{ticker_a}/{ticker_b}")
    st.divider()
