import { notFound } from "next/navigation";
import { fetchPairBySlug } from "@/lib/pares-repo";
import { getPairStatus } from "@/lib/pairs-data";
import { PairOverview } from "@/components/PairOverview";

// Renderizado por requisição — os dados vêm do Supabase e mudam todo dia
// útil via a rotina agendada, então nunca devem ficar congelados num
// build estático.
export const dynamic = "force-dynamic";

export default async function PairPage({ params }: PageProps<"/pair/[pair]">) {
  const { pair: slug } = await params;
  const pairDef = await fetchPairBySlug(slug);
  if (!pairDef) notFound();

  const status = await getPairStatus(pairDef.label);

  return <PairOverview pairDef={pairDef} status={status} />;
}
