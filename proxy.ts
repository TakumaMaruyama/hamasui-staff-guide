import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.svg"
  ) return NextResponse.next();
  try {
    if (await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) return NextResponse.next();
  } catch { /* fail closed when SESSION_SECRET is missing */ }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
