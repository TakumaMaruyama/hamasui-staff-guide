import { NextResponse } from "next/server";
import { sameOrigin, SESSION_COOKIE_NAME } from "@/src/lib/auth/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "不正なリクエストです。" }, { status: 403 });
  const response = NextResponse.redirect(new URL("/login", request.headers.get("origin")!), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
  return response;
}
