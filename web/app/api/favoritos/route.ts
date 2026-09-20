import { NextResponse } from "next/server";
import { pairExists } from "@/lib/pares-repo";
import { toggleFavorite } from "@/lib/favorites-repo";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const par = typeof body?.par === "string" ? body.par : "";

  if (!(await pairExists(par))) {
    return NextResponse.json({ error: "Par inválido." }, { status: 400 });
  }

  const favorito = await toggleFavorite(par);
  return NextResponse.json({ ok: true, favorito });
}
