import { NextResponse } from "next/server";
import { PAIRS } from "@/lib/config";
import { getLatestZScore } from "@/lib/pairs-data";
import { enterPosition } from "@/lib/positions";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const par = typeof body?.par === "string" ? body.par : "";

  if (!PAIRS.some((p) => p.label === par)) {
    return NextResponse.json({ error: "Par inválido." }, { status: 400 });
  }

  const z = await getLatestZScore(par);
  const result = await enterPosition(par, z);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
