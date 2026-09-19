import type { ReactNode } from "react";
import { PAIRS } from "@/lib/config";
import { getPairStatus } from "@/lib/pairs-data";
import { Sidebar, type SidebarPair } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

// Layout do grupo de rotas (app) — envolve /dashboard e /pair/[pair], que
// não têm um formato de params em comum, então tipamos manualmente em vez
// de usar o helper LayoutProps (pensado pra uma única rota).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const sidebarPairs: SidebarPair[] = await Promise.all(
    PAIRS.map(async (pair) => {
      const status = await getPairStatus(pair.label);
      return {
        slug: pair.slug,
        label: pair.label,
        zScore: status.ultimo?.z_score_63d ?? null,
        estado: status.estado,
      };
    })
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar pairs={sidebarPairs} />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
