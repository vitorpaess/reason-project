"""Orquestra a execução diária: coleta preços e recalcula z-scores.

Pensado para ser chamado por um cron/rotina agendada após o fechamento do
mercado americano.
"""

import collect_prices
import compute_zscore


def run() -> None:
    collect_prices.run()
    print()
    compute_zscore.run()


if __name__ == "__main__":
    run()
