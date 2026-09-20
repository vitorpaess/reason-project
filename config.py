import os

from dotenv import load_dotenv

load_dotenv()

_raw_supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
# Aceita tanto a URL base do projeto quanto a URL completa da REST API.
SUPABASE_URL = _raw_supabase_url.removesuffix("/rest/v1")
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

# Planilhas do Google Sheets que substituem a Alpha Vantage como fonte de
# dados — "Pares DATA" (ticker_a, ticker_b, setor) e "Preços DATA" (preço de
# fechamento diário, formato largo). Compartilhadas como "qualquer pessoa
# com o link", lidas via export CSV público (ver sheets_client.py).
PARES_SHEET_ID = "1__1sjYN0GbDOooaaWo9Xx1RLoHjUFp6FhBTk5Q5hiA8"
PRECOS_SHEET_ID = "1JBWNhGQQKp3Ib8k5scG-ghmhZOzTge5s7ZoocRiJ624"

# Janela usada tanto para a correlação móvel quanto para a média/desvio-padrão
# do spread no cálculo do z-score. Ajustável para recalcular com outro parâmetro.
ROLLING_WINDOW_DAYS = 63

ENTRY_THRESHOLD = 1.2
EXIT_THRESHOLD = 0.5

# Mínimo de dias de histórico comum entre as duas ações do par para considerar
# o z-score/correlação estatisticamente confiável.
MIN_HISTORY_DAYS = 90

TABLE_PRECOS = "precos_diarios"
TABLE_PARES_CONFIG = "pares_config"
# Só a última linha calculada por par (não o histórico) — o histórico
# completo é recalculado sob demanda no Next.js a partir de TABLE_PRECOS.
TABLE_PARES_STATUS = "pares_status"
