import { PAIRS } from "@/lib/config";
import { getPairStatus } from "@/lib/pairs-data";
import { PairOverview } from "@/components/PairOverview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const pairs = await Promise.all(
    PAIRS.map(async (pairDef) => ({
      pairDef,
      status: await getPairStatus(pairDef.label),
    }))
  );

  return (
    <div className="flex flex-col gap-12">
      {pairs.map(({ pairDef, status }, i) => (
        <div key={pairDef.slug}>
          <PairOverview pairDef={pairDef} status={status} detailHref={`/pair/${pairDef.slug}`} />
          {i < pairs.length - 1 && <hr className="mt-12 border-border" />}
        </div>
      ))}
    </div>
  );
}
