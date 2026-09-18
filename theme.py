"""Paleta e estilo compartilhados pelo dashboard — visual minimalista, dark, B2B.

Valores vêm da paleta validada do skill de dataviz (contraste e distinção
CVD já testados para superfície escura), não escolhidos a olho.
"""

SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"

# Superfícies e tinta (chart chrome & ink, modo escuro)
PAGE_BG = "#0d0d0d"
SURFACE = "#1a1a19"
INK_PRIMARY = "#ffffff"
INK_SECONDARY = "#c3c2b7"
INK_MUTED = "#898781"
GRIDLINE = "#2c2c2a"
BASELINE = "#383835"
BORDER = "rgba(255,255,255,0.10)"

# Série de dados (categorical slot 1 — azul, neutro, não carrega status)
SERIES_Z_SCORE = "#3987e5"

# Cores de status (fixas, nunca reaproveitadas para séries)
STATUS_CRITICAL = "#d03b3b"  # limiar de entrada — ação
STATUS_GOOD = "#0ca30c"      # limiar de saída — normalização

CSS = f"""
<style>
#MainMenu {{visibility: hidden;}}
footer {{visibility: hidden;}}

.block-container {{
    padding-top: 2.5rem;
    padding-bottom: 3rem;
    max-width: 1120px;
}}

html, body, [class*="css"] {{
    font-family: {SANS};
}}

h1 {{
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: {INK_PRIMARY};
    margin-bottom: 0.1rem;
}}

h2 {{
    font-size: 0.95rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: {INK_SECONDARY};
    margin-top: 0;
    margin-bottom: 0.75rem;
}}

h3 {{
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: {INK_MUTED};
}}

hr {{
    border-color: {GRIDLINE};
    margin: 2rem 0;
}}

[data-testid="stMetric"] {{
    background-color: {SURFACE};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 0.9rem 1rem;
}}

[data-testid="stMetricLabel"] {{
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: {INK_MUTED};
}}

[data-testid="stMetricValue"] {{
    font-size: 1.15rem;
    font-weight: 600;
    color: {INK_PRIMARY};
}}

[data-testid="stMetricDelta"] {{
    font-size: 0.78rem;
    color: {INK_SECONDARY};
}}

[data-testid="stCaptionContainer"] {{
    color: {INK_MUTED};
}}

[data-testid="stDataFrame"] {{
    border: 1px solid {BORDER};
    border-radius: 6px;
}}

/* Navegação lateral estilo lista de itens (sidebar) */
[data-testid="stSidebar"] {{
    background-color: {PAGE_BG};
    border-right: 1px solid {GRIDLINE};
}}

[data-testid="stSidebar"] .block-container {{
    padding-top: 1.5rem;
}}

[data-testid="stSidebar"] h3 {{
    padding: 0 0.25rem;
    margin-bottom: 0.5rem;
}}

[data-testid="stSidebar"] button {{
    justify-content: flex-start !important;
    text-align: left !important;
    border: none !important;
    box-shadow: none !important;
    font-weight: 500 !important;
    padding: 0.45rem 0.6rem !important;
    margin-bottom: 0.1rem;
    border-radius: 6px !important;
}}

[data-testid="stSidebar"] button[kind="secondary"] {{
    background-color: transparent !important;
    color: {INK_SECONDARY} !important;
}}

[data-testid="stSidebar"] button[kind="secondary"]:hover {{
    background-color: {SURFACE} !important;
    color: {INK_PRIMARY} !important;
}}

[data-testid="stSidebar"] button[kind="primary"] {{
    background-color: {SURFACE} !important;
    color: {INK_PRIMARY} !important;
    border-left: 2px solid {SERIES_Z_SCORE} !important;
}}
</style>
"""


def plotly_layout(fig, height: int = 340) -> None:
    """Aplica o chrome dark/minimalista consistente a um gráfico Plotly."""
    fig.update_layout(
        height=height,
        margin=dict(t=16, b=16, l=8, r=8),
        paper_bgcolor=SURFACE,
        plot_bgcolor=SURFACE,
        font=dict(family=SANS, color=INK_SECONDARY, size=12),
        showlegend=False,
        hoverlabel=dict(bgcolor=PAGE_BG, font=dict(family=SANS, color=INK_PRIMARY)),
    )
    fig.update_xaxes(
        gridcolor=GRIDLINE,
        zerolinecolor=BASELINE,
        linecolor=BASELINE,
        tickfont=dict(color=INK_MUTED, size=11),
        title=None,
    )
    fig.update_yaxes(
        gridcolor=GRIDLINE,
        zerolinecolor=BASELINE,
        linecolor=BASELINE,
        tickfont=dict(color=INK_MUTED, size=11),
        title=None,
    )
