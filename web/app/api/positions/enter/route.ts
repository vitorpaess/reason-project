import { NextResponse } from "next/server";
import { pairExists } from "@/lib/pares-repo";
import { getLatestZScore } from "@/lib/pairs-data";
import { enterPosition } from "@/lib/positions";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const par = typeof body?.par === "string" ? body.par : "";

  if (!(await pairExists(par))) {
    return NextResponse.json({ error: "Par inválido." }, { status: 400 });
  }

  const z = await getLatestZScore(par);
  const result = await enterPosition(par, z);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
