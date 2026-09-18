import { NextResponse } from "next/server";
import { expectedToken, isValidPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const expected = expectedToken();
  if (!expected) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD não configurada no servidor." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
