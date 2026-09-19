import Image from "next/image";
import { COMPANIES } from "@/lib/companies";
import { logoUrl } from "@/lib/logo";
import { colors } from "@/lib/theme";

// Logos das duas empresas do par, sobrepostos (uma atrás da outra) —
// substitui o bullet neutro que ficava ao lado do nome do par na sidebar.
export function PairLogos({ tickers, muted = false }: { tickers: [string, string]; muted?: boolean }) {
  return (
    <span className="flex shrink-0 items-center transition-opacity" style={{ opacity: muted ? 0.6 : 1 }}>
      {tickers.map((ticker, i) => {
        const empresa = COMPANIES[ticker];
        if (!empresa) return null;
        return (
          <Image
            key={ticker}
            src={logoUrl(empresa.dominio)}
            alt={empresa.nome}
            width={16}
            height={16}
            unoptimized
            className="rounded-full"
            style={{
              marginLeft: i === 0 ? 0 : -6,
              zIndex: i === 0 ? 2 : 1,
              border: `1.5px solid ${colors.pageBg}`,
              backgroundColor: colors.surfaceRaised,
            }}
          />
        );
      })}
    </span>
  );
}
