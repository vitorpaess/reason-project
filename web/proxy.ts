import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { expectedToken, SESSION_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const expected = expectedToken();

  // Sem senha configurada no ambiente: falha fechado (nega acesso) em vez
  // de deixar o dashboard aberto por engano.
  if (!expected) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD não configurada no servidor." },
      { status: 500 }
    );
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|api/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
