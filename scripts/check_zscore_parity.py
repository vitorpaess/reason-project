"""Lado Python do teste de paridade compute_zscore.py <-> zscore-calc.ts.

Roda o MESMO cálculo (_compute_signals, o núcleo de compute_zscore.py) em
cima de um par sintético fixo (fixtures/zscore_parity_precos.csv) e imprime
o resultado como JSON em stdout — nada mais deve ir pra stdout, é isso que
web/scripts/check-zscore-parity.ts lê e compara com o resultado do lado
TypeScript (mesmo par, mesma data, mesmo z).

Não depende de rede/Supabase: _compute_signals é uma função pura sobre um
DataFrame já carregado, então dá pra chamar direto com o preço sintético.
Só "import compute_zscore" já dispara "import config" (lê variáveis de
ambiente via .env) e "import db" (cliente Supabase, mas só criado sob
demanda — lazy), então precisa de um .env válido na raiz do projeto pra
rodar, mesmo sem fazer nenhuma chamada de rede de fato.

Uso: python3 scripts/check_zscore_parity.py
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import pandas as pd  # noqa: E402

import compute_zscore  # noqa: E402

FIXTURE = REPO_ROOT / "fixtures" / "zscore_parity_precos.csv"
TICKER_A = "ZTSTA"
TICKER_B = "ZTSTB"


def main() -> None:
    df = pd.read_csv(FIXTURE)
    df["data"] = pd.to_datetime(df["data"])
    df = compute_zscore._compute_signals(df, TICKER_A, TICKER_B)

    linhas = []
    for _, row in df.iterrows():
        linhas.append(
            {
                "data": row["data"].date().isoformat(),
                "z_score_63d": compute_zscore._num_or_none(row["z_score_63d"]),
                "spread": compute_zscore._num_or_none(row["spread"]),
                "correlacao_movel_63d": compute_zscore._num_or_none(row["correlacao_movel_63d"]),
                "sinal": row["sinal"],
                "direcao": row["direcao"],
            }
        )

    print(json.dumps({"par": f"{TICKER_A}/{TICKER_B}", "linhas": linhas}))


if __name__ == "__main__":
    main()
