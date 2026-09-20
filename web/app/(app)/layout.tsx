import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";

// Layout do grupo de rotas (app) — envolve /dashboard e /pair/[pair], que
// não têm um formato de params em comum, então tipamos manualmente em vez
// de usar o helper LayoutProps (pensado pra uma única rota).
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
