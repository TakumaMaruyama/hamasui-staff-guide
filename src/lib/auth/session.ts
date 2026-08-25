export const SESSION_COOKIE_NAME = "hamasui_staff_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type AuthSession = { issuedAt: number; expiresAt: number };

function requiredEnv(name: "SESSION_SECRET" | "STAFF_SITE_PASSWORD"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(message: string): Promise<Uint8Array> {
  const secret = new TextEncoder().encode(
    `hamasui-staff-session-v1\0${requiredEnv("SESSION_SECRET")}\0${requiredEnv("STAFF_SITE_PASSWORD")}`,
  );
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  requiredEnv("STAFF_SITE_PASSWORD");
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + SESSION_MAX_AGE;
  const payload = `${issuedAt}.${expiresAt}`;
  return `${toBase64Url(new TextEncoder().encode(payload))}.${toBase64Url(await hmac(payload))}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<AuthSession | null> {
  if (!token) return null;
  const [encodedPayload, encodedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra.length > 0) return null;
  try {
    const payload = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const [issuedAtText, expiresAtText, ...parts] = payload.split(".");
    const issuedAt = Number(issuedAtText);
    const expiresAt = Number(expiresAtText);
    if (parts.length || !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || expiresAt <= issuedAt) return null;
    const expected = await hmac(payload);
    if (!constantTimeEqual(expected, fromBase64Url(encodedSignature))) return null;
    if (expiresAt <= Math.floor(now / 1000)) return null;
    return { issuedAt, expiresAt };
  } catch {
    return null;
  }
}

export async function verifyStaffPassword(password: string): Promise<boolean> {
  const expected = new TextEncoder().encode(requiredEnv("STAFF_SITE_PASSWORD"));
  const actual = new TextEncoder().encode(password);
  const expectedDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", expected));
  const actualDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", actual));
  return constantTimeEqual(expectedDigest, actualDigest);
}

export async function getSession(request?: Request): Promise<AuthSession | null> {
  const cookieHeader = request?.headers.get("cookie");
  const token = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))?.slice(SESSION_COOKIE_NAME.length + 1);
  return verifySessionToken(token);
}

export async function requireRequestAuth(request: Request): Promise<AuthSession> {
  const session = await getSession(request);
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export function safeReturnTo(value: string | null | undefined, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const target = new URL(value, origin);
    const blockedPath = target.pathname === "/login" || target.pathname.startsWith("/api/auth/");
    return target.origin === origin && !blockedPath
      ? `${target.pathname}${target.search}`
      : "/";
  } catch {
    return "/";
  }
}

function originFromHost(host: string | null | undefined, protocol: string): string | null {
  const normalizedHost = host?.trim();
  if (
    !normalizedHost
    || !["http", "https"].includes(protocol)
    || /[/\\@?#\s]/.test(normalizedHost)
  ) return null;
  try {
    const url = new URL(`${protocol}://${normalizedHost}`);
    return url.host === normalizedHost ? url.origin : null;
  } catch {
    return null;
  }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let requestOrigin: string;
  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.origin !== origin) return false;
    requestOrigin = parsedOrigin.origin;
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
  const proxyOrigin = originFromHost(host, protocol);
  if (proxyOrigin) allowedOrigins.add(proxyOrigin);

  for (const domain of process.env.REPLIT_DOMAINS?.split(",") ?? []) {
    const replitOrigin = originFromHost(domain, "https");
    if (replitOrigin) allowedOrigins.add(replitOrigin);
  }
  const developmentOrigin = originFromHost(process.env.REPLIT_DEV_DOMAIN, "https");
  if (developmentOrigin) allowedOrigins.add(developmentOrigin);

  return allowedOrigins.has(requestOrigin);
}
