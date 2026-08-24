import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken, type AuthSession } from "./session";

export async function requireAuth(): Promise<AuthSession> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) redirect("/login");
  return session;
}
