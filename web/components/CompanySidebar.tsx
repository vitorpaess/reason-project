import Image from "next/image";
import { COMPANIES } from "@/lib/companies";
import { logoUrl } from "@/lib/logo";

export function CompanySidebar({ tickers }: { tickers: [string, string] }) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-56">
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
          </div>
        );
      })}
    </aside>
  );
}
