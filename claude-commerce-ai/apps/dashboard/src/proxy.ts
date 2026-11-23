import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proteção mínima da Fase 1: HTTP Basic Auth opcional (DASHBOARD_USER / DASHBOARD_PASSWORD).
 * Obrigatória antes de expor o dashboard fora da máquina local. Na Fase 2 será substituída por
 * Supabase Auth com papéis (operador/gestor).
 */
export function proxy(request: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Claude Commerce AI", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
