import { PAIRS } from "@/lib/config";
import { getPairStatus } from "@/lib/pairs-data";
import { pairIcon } from "@/lib/theme";
import { Sidebar, type SidebarPair } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function PairLayout({ children }: LayoutProps<"/pair">) {
  const sidebarPairs: SidebarPair[] = await Promise.all(
    PAIRS.map(async (pair) => {
      const status = await getPairStatus(pair.label);
      return {
        slug: pair.slug,
        label: pair.label,
        icon: pairIcon[pair.slug] ?? "",
        zScore: status.ultimo?.z_score ?? null,
        estado: status.estado,
      };
    })
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar pairs={sidebarPairs} />
      <main className="flex-1 px-10 py-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
