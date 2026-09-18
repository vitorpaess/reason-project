"""Dashboard local (Streamlit) do sistema de pairs trading.

Lê diretamente do Supabase (tabelas precos_diarios e pares_zscore) — não
recalcula nada, só visualiza o que collect_prices.py / compute_zscore.py
já salvaram. Rode com: streamlit run dashboard.py
"""

from datetime import date
from typing import Optional

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import config
import db
import theme

st.set_page_config(page_title="Pairs Trading Monitor", layout="wide")
st.markdown(theme.CSS, unsafe_allow_html=True)

PAIR_LABELS = [f"{a}/{b}" for a, b in config.PAIRS]

STATUS_LABELS = {
    "aberta": "Posição aberta",
    "saida": "Posição de saída",
    "espera": "Posição de espera",
}
STATUS_COLORS = {
    "aberta": theme.STATUS_CRITICAL,
    "saida": theme.STATUS_GOOD,
    "espera": theme.INK_MUTED,
}


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


def compute_status(df: pd.DataFrame) -> Optional[dict]:
    """Determina o estado do par: 'aberta' (|z| passou de 1.2 e ainda não voltou
    a |z| < 0.5), 'saida' (voltou a |z| < 0.5 hoje) ou 'espera' (nenhum dos dois).
    """
    df_valido = df.dropna(subset=["z_score"])
    if df_valido.empty:
        return None

    ultimo = df_valido.iloc[-1]
    historico = build_signal_history(df)
    posicao_aberta = not historico.empty and historico.iloc[0]["data_saida"] is None

    if posicao_aberta:
        estado = "aberta"
    elif ultimo["sinal"] == "saida":
        estado = "saida"
    else:
        estado = "espera"

    return {
        "estado": estado,
        "z_score": ultimo["z_score"],
        "correlacao": ultimo["correlacao_movel_63d"],
        "ultimo": ultimo,
        "historico": historico,
    }


if "selected_pair" not in st.session_state:
    st.session_state.selected_pair = PAIR_LABELS[0]

with st.sidebar:
    st.markdown("### Pairs Trading")
    for label in PAIR_LABELS:
        is_active = st.session_state.selected_pair == label
        icon = theme.PAIR_ICON.get(label, "")
        if st.button(
            f"{icon}  {label}",
            key=f"nav_{label}",
            type="primary" if is_active else "secondary",
            use_container_width=True,
        ):
            st.session_state.selected_pair = label
            st.rerun()

        info = compute_status(load_zscore_df(label))
        if info is None:
            st.markdown(
                f"<div class='nav-subline'>sem dados suficientes</div>",
                unsafe_allow_html=True,
            )
        else:
            cor = STATUS_COLORS[info["estado"]]
            texto = STATUS_LABELS[info["estado"]]
            st.markdown(
                f"<div class='nav-subline'>"
                f"z <span style='color:{theme.INK_SECONDARY};font-weight:600;'>{info['z_score']:+.2f}</span>"
                f" · <span style='color:{cor};font-weight:600;'>{texto}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )


def render_pair(par: str) -> None:
    st.markdown(f"# {theme.PAIR_ICON.get(par, '')}  {par}")
    df = load_zscore_df(par)

    if df.empty:
        st.info("Ainda não há dados calculados para este par. Rode collect_prices.py e compute_zscore.py.")
        return

    info = compute_status(df)
    if info is None:
        st.warning(
            f"Histórico insuficiente ainda para calcular z-score/correlação "
            f"(janela de {config.ROLLING_WINDOW_DAYS} dias). Aguarde mais coletas diárias."
        )
        return

    ultimo = info["ultimo"]
    historico = info["historico"]
    estado = info["estado"]

    col1, col2, col3 = st.columns(3)
    with col1:
        pill = theme.status_pill(STATUS_LABELS[estado], STATUS_COLORS[estado])
        if estado == "aberta":
            entrada = historico.iloc[0]
            detalhe = f"desde {entrada['data_entrada']} ({entrada['dias_em_aberto']}d) — {entrada['direcao']}"
        elif estado == "saida":
            saida = historico.iloc[0]
            detalhe = f"entrada em {saida['data_entrada']} (z {saida['z_entrada']:+.2f}) → saída hoje"
        else:
            detalhe = "aguardando |z| > 1.20"
        st.markdown(
            f"<div class='status-card'>"
            f"<div class='label'>Status</div>"
            f"{pill}"
            f"<div class='detail'>{detalhe}</div>"
            f"</div>",
            unsafe_allow_html=True,
        )
    with col2:
        st.metric("Z-score atual", f"{ultimo['z_score']:.2f}")
    with col3:
        corr = info["correlacao"]
        st.metric(
            f"Correlação móvel {config.ROLLING_WINDOW_DAYS}d",
            f"{corr:.2f}" if pd.notna(corr) else "N/D",
        )
        if pd.notna(corr) and abs(corr) < 0.5:
            st.caption("Correlação baixa — par pode estar perdendo a relação estatística.")

    # --- Gráfico de z-score ---
    y_max = max(df["z_score"].max(), config.ENTRY_THRESHOLD) + 0.3
    y_min = min(df["z_score"].min(), -config.ENTRY_THRESHOLD) - 0.3

    fig = go.Figure()

    # Zonas de entrada/saída como faixas coloridas (substitui linhas + texto)
    fig.add_hrect(y0=config.ENTRY_THRESHOLD, y1=y_max, fillcolor=theme.STATUS_CRITICAL, opacity=0.08, line_width=0)
    fig.add_hrect(y0=y_min, y1=-config.ENTRY_THRESHOLD, fillcolor=theme.STATUS_CRITICAL, opacity=0.08, line_width=0)
    fig.add_hrect(
        y0=-config.EXIT_THRESHOLD, y1=config.EXIT_THRESHOLD, fillcolor=theme.STATUS_GOOD, opacity=0.07, line_width=0
    )

    fig.add_trace(
        go.Scatter(
            x=df["data"],
            y=df["z_score"],
            mode="lines",
            name="z-score",
            line=dict(color=theme.SERIES_Z_SCORE, width=2.5, shape="spline", smoothing=0.3),
            fill="tozeroy",
            fillcolor=theme.hex_to_rgba(theme.SERIES_Z_SCORE, 0.12),
            hovertemplate="z = %{y:.2f}<extra></extra>",
        )
    )

    eventos = df[df["sinal"].isin(["entrada", "saida"])]
    if not eventos.empty:
        fig.add_trace(
            go.Scatter(
                x=eventos["data"],
                y=eventos["z_score"],
                mode="markers",
                name="sinais",
                marker=dict(
                    size=9,
                    color=[
                        theme.STATUS_CRITICAL if s == "entrada" else theme.STATUS_GOOD
                        for s in eventos["sinal"]
                    ],
                    line=dict(width=1.5, color=theme.SURFACE),
                ),
                text=["Entrada" if s == "entrada" else "Saída" for s in eventos["sinal"]],
                hovertemplate="%{text} · z = %{y:.2f}<extra></extra>",
            )
        )

    fig.update_yaxes(range=[y_min, y_max])
    theme.plotly_layout(fig)
    st.plotly_chart(fig, theme=None, use_container_width=True)

    st.markdown(
        f"<div class='chart-legend'>"
        f"<span><span class='dot' style='background:{theme.STATUS_CRITICAL}'></span>"
        f"zona de entrada · |z| &gt; {config.ENTRY_THRESHOLD}</span>"
        f"<span><span class='dot' style='background:{theme.STATUS_GOOD}'></span>"
        f"zona de saída · |z| &lt; {config.EXIT_THRESHOLD}</span>"
        f"</div>",
        unsafe_allow_html=True,
    )

    # --- Histórico de sinais ---
    st.markdown("### Histórico de sinais")
    if historico.empty:
        st.caption("Nenhum sinal de entrada/saída disparado ainda.")
    else:
        st.dataframe(historico, width="stretch", hide_index=True)


render_pair(st.session_state.selected_pair)
