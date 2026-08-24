import { NextResponse } from "next/server";
import { clearLoginAttempts, isRateLimited, LOGIN_RETRY_AFTER_SECONDS, loginRateLimitKey, recordLoginAttempt } from "@/src/lib/auth/rate-limit";
import { createSessionToken, safeReturnTo, sameOrigin, SESSION_COOKIE_NAME, SESSION_MAX_AGE, verifyStaffPassword } from "@/src/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "不正なリクエストです。" }, { status: 403 });
  const publicOrigin = request.headers.get("origin")!;
  const key = loginRateLimitKey(request);
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "入力を確認してください。" }, { status: 400 }); }
  const returnTo = safeReturnTo(typeof form.get("returnTo") === "string" ? form.get("returnTo") as string : null, publicOrigin);
  if (isRateLimited(key)) {
    const response = NextResponse.redirect(
      new URL(`/login?error=rate&returnTo=${encodeURIComponent(returnTo)}`, publicOrigin),
      303,
    );
    response.headers.set("Retry-After", String(LOGIN_RETRY_AFTER_SECONDS));
    return response;
  }
  const password = form.get("password");
  if (typeof password !== "string" || !password || !(await verifyStaffPassword(password))) {
    recordLoginAttempt(key);
    return NextResponse.redirect(new URL(`/login?error=1&returnTo=${encodeURIComponent(returnTo)}`, publicOrigin), 303);
  }
  clearLoginAttempts(key);
  const response = NextResponse.redirect(new URL(returnTo, publicOrigin), 303);
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_MAX_AGE, path: "/" });
  return response;
}
