import os

from dotenv import load_dotenv

load_dotenv()

ALPHA_VANTAGE_API_KEY = os.environ["ALPHA_VANTAGE_API_KEY"]

_raw_supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
# Aceita tanto a URL base do projeto quanto a URL completa da REST API.
SUPABASE_URL = _raw_supabase_url.removesuffix("/rest/v1")
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

# Tickers monitorados, agrupados por par. Cada par é independente.
PAIRS = [
    ("RKLB", "PL"),
    ("RPD", "TENB"),
    ("ALGT", "CPA"),
    ("TRMB", "FICO"),
]

TICKERS = sorted({t for pair in PAIRS for t in pair})

# Janela usada tanto para a correlação móvel quanto para a média/desvio-padrão
# do spread no cálculo do z-score. Ajustável para recalcular com outro parâmetro.
ROLLING_WINDOW_DAYS = 63

ENTRY_THRESHOLD = 1.2
EXIT_THRESHOLD = 0.5

# Mínimo de dias de histórico comum entre as duas ações do par para considerar
# o z-score/correlação estatisticamente confiável.
MIN_HISTORY_DAYS = 90

TABLE_PRECOS = "precos_diarios"
TABLE_ZSCORE = "pares_zscore"
