"""Paleta e estilo compartilhados pelo dashboard.

Visual: minimalista, dark, com o acabamento "produto de startup" (cards com
sombra suave, cantos arredondados, tags em pílula) sobre a paleta validada
do skill de dataviz (contraste e distinção CVD testados para superfície
escura) — a paleta em si não muda, só o acabamento em volta dela.
"""

FONT_IMPORT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"

# Superfícies e tinta (chart chrome & ink, modo escuro)
PAGE_BG = "#0d0d0d"
SURFACE = "#1a1a19"
SURFACE_RAISED = "#212120"
INK_PRIMARY = "#ffffff"
INK_SECONDARY = "#c3c2b7"
INK_MUTED = "#898781"
GRIDLINE = "#2c2c2a"
BASELINE = "#383835"
BORDER = "rgba(255,255,255,0.08)"
SHADOW = "0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.24)"

# Série de dados (categorical slot 1 — azul, neutro, não carrega status)
SERIES_Z_SCORE = "#3987e5"

# Cores de status (fixas, nunca reaproveitadas para séries)
STATUS_CRITICAL = "#d03b3b"  # zona/limiar de entrada — ação
STATUS_GOOD = "#0ca30c"      # zona/limiar de saída — normalização

PAIR_ICON = {
    "RKLB/PL": "🚀",
    "RPD/TENB": "🛡️",
}


def hex_to_rgba(hex_color: str, alpha: float) -> str:
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def status_pill(label: str, color: str) -> str:
    return (
        f"<span style='background:{color}22; color:{color}; padding:3px 10px; "
        f"border-radius:999px; font-size:0.72rem; font-weight:600; "
        f"white-space:nowrap;'>{label}</span>"
    )


CSS = f"""
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="{FONT_IMPORT}">
<style>
#MainMenu {{visibility: hidden;}}
footer {{visibility: hidden;}}

.stApp {{
    background-color: {PAGE_BG};
}}

.block-container {{
    padding-top: 2.5rem;
    padding-bottom: 3rem;
    max-width: 1160px;
}}

html, body, [class*="css"] {{
    font-family: {SANS};
}}

h1 {{
    font-size: 1.5rem;
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
    font-size: 0.8rem;
    font-weight: 600;
    color: {INK_SECONDARY};
    margin-bottom: 0.5rem;
}}

hr {{
    border-color: {GRIDLINE};
    margin: 2rem 0;
}}

[data-testid="stMetric"] {{
    background-color: {SURFACE};
    border: 1px solid {BORDER};
    border-radius: 12px;
    padding: 1rem 1.1rem;
    box-shadow: {SHADOW};
}}

[data-testid="stMetricLabel"] {{
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: {INK_MUTED};
}}

[data-testid="stMetricValue"] {{
    font-size: 1.2rem;
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
    border-radius: 12px;
    box-shadow: {SHADOW};
    overflow: hidden;
}}

/* Card customizado (status), com o mesmo acabamento dos st.metric */
.status-card {{
    background-color: {SURFACE};
    border: 1px solid {BORDER};
    border-radius: 12px;
    padding: 1rem 1.1rem;
    box-shadow: {SHADOW};
    height: 100%;
}}
.status-card .label {{
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: {INK_MUTED};
    margin-bottom: 0.45rem;
}}
.status-card .detail {{
    font-size: 0.78rem;
    color: {INK_SECONDARY};
    margin-top: 0.5rem;
    line-height: 1.4;
}}

/* Legenda de zonas do gráfico */
.chart-legend {{
    display: flex;
    gap: 1.25rem;
    font-size: 0.75rem;
    color: {INK_MUTED};
    margin-top: -0.5rem;
    margin-bottom: 1rem;
}}
.chart-legend .dot {{
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.4rem;
}}

/* Navegação lateral estilo lista de itens (sidebar) */
[data-testid="stSidebar"] {{
    background-color: {PAGE_BG};
    border-right: 1px solid {GRIDLINE};
}}

[data-testid="stSidebar"] .block-container {{
    padding-top: 1.75rem;
}}

[data-testid="stSidebar"] h3 {{
    padding: 0 0.4rem;
    margin-bottom: 0.75rem;
    color: {INK_PRIMARY};
}}

[data-testid="stSidebar"] button {{
    justify-content: flex-start !important;
    text-align: left !important;
    border: none !important;
    box-shadow: none !important;
    font-weight: 500 !important;
    font-size: 0.92rem !important;
    padding: 0.5rem 0.65rem !important;
    margin-bottom: 0.05rem;
    border-radius: 8px !important;
    transition: background-color 0.15s ease;
}}

[data-testid="stSidebar"] button[kind="secondary"] {{
    background-color: transparent !important;
    color: {INK_SECONDARY} !important;
}}

[data-testid="stSidebar"] button[kind="secondary"]:hover {{
    background-color: {SURFACE_RAISED} !important;
    color: {INK_PRIMARY} !important;
}}

[data-testid="stSidebar"] button[kind="primary"] {{
    background-color: {SURFACE_RAISED} !important;
    color: {INK_PRIMARY} !important;
    border-left: 2px solid {SERIES_Z_SCORE} !important;
}}

.nav-subline {{
    padding: 0 0.65rem;
    margin-top: -0.45rem;
    margin-bottom: 0.65rem;
    font-size: 0.72rem;
    color: {INK_MUTED};
}}
</style>
"""


def plotly_layout(fig, height: int = 380) -> None:
    """Aplica o chrome dark/minimalista consistente a um gráfico Plotly."""
    fig.update_layout(
        height=height,
        margin=dict(t=24, b=16, l=8, r=8),
        paper_bgcolor=SURFACE,
        plot_bgcolor=SURFACE,
        font=dict(family=SANS, color=INK_SECONDARY, size=12),
        showlegend=False,
        hoverlabel=dict(
            bgcolor=SURFACE_RAISED,
            bordercolor=BASELINE,
            font=dict(family=SANS, color=INK_PRIMARY),
        ),
        hovermode="x unified",
    )
    fig.update_xaxes(
        showgrid=False,
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
