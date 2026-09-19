import { COMPANIES } from "@/lib/companies";
import type { PricePoint } from "@/lib/company-prices";
import { CompanyPriceChart } from "@/components/CompanyPriceChart";

export function CompanyPriceSection({
  tickers,
  series,
}: {
  tickers: [string, string];
  series: [PricePoint[], PricePoint[]];
}) {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-ink-secondary">Preço das ações</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {tickers.map((ticker, i) => {
          const empresa = COMPANIES[ticker];
          return (
            <div
              key={ticker}
              className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {empresa ? `${empresa.nome} (${ticker})` : ticker}
              </div>
              <CompanyPriceChart ticker={ticker} points={series[i]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
