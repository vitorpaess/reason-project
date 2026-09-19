import Image from "next/image";
import { COMPANIES } from "@/lib/companies";
import { logoUrl } from "@/lib/logo";

const formatadorCompacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatadorInteiro = new Intl.NumberFormat("pt-BR");

function edgarUrl(cik: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K&dateb=&owner=include&count=40`;
}

export function CompanySidebar({ tickers }: { tickers: [string, string] }) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
      {tickers.map((ticker) => {
        const empresa = COMPANIES[ticker];
        if (!empresa) return null;
        return (
          <div
            key={ticker}
            className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-3">
              <Image
                src={logoUrl(empresa.dominio)}
                alt={empresa.nome}
                width={32}
                height={32}
                className="rounded-md bg-surface-raised"
                unoptimized
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-primary">{empresa.ticker}</div>
                <div className="truncate text-xs text-ink-muted">{empresa.bolsa}</div>
              </div>
            </div>

            <div className="mt-3 text-xs leading-snug text-ink-secondary">{empresa.nome}</div>
            <div className="mt-1 text-xs leading-snug text-ink-muted">{empresa.setor}</div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-raised px-2.5 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-ink-muted">Receita (TTM)</div>
                <div className="text-xs font-semibold tabular-nums text-ink-primary">
                  US$ {formatadorCompacto.format(empresa.receitaTtmUsd)}
                </div>
              </div>
              <div className="rounded-lg bg-surface-raised px-2.5 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-ink-muted">Funcionários</div>
                <div className="text-xs font-semibold tabular-nums text-ink-primary">
                  {formatadorInteiro.format(empresa.funcionarios)}
                </div>
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-ink-muted transition-colors hover:text-ink-secondary">
                Sobre
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{empresa.descricao}</p>
            </details>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
              <a
                href={empresa.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-muted transition-colors hover:text-ink-primary"
              >
                Site oficial
              </a>
              <a
                href={`https://finance.yahoo.com/quote/${empresa.ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-muted transition-colors hover:text-ink-primary"
              >
                Yahoo Finance
              </a>
              <a
                href={edgarUrl(empresa.cik)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-muted transition-colors hover:text-ink-primary"
              >
                Filings (SEC)
              </a>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
