import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { fetchFavoritesWithStatus } from "@/lib/favorites-repo";

// Layout do grupo de rotas (app) — envolve /dashboard e /pair/[pair], que
// não têm um formato de params em comum, então tipamos manualmente em vez
// de usar o helper LayoutProps (pensado pra uma única rota).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const favoritos = await fetchFavoritesWithStatus();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar favoritos={favoritos} />
      <main className="flex-1 overflow-y-auto px-10 py-8">{children}</main>
    </div>
  );
}
