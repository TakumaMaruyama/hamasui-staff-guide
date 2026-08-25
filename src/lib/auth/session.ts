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
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin || !value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const target = new URL(value, normalizedOrigin);
    const blockedPath = target.pathname === "/login" || target.pathname.startsWith("/api/auth/");
    return target.origin === normalizedOrigin && !blockedPath
      ? `${target.pathname}${target.search}`
      : "/";
  } catch {
    return "/";
  }
}

function normalizeOrigin(value: string | null | undefined, requiredProtocol?: "http:" | "https:"): string | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  try {
    const url = new URL(normalizedValue);
    if (
      !["http:", "https:"].includes(url.protocol)
      || (requiredProtocol && url.protocol !== requiredProtocol)
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function originFromHost(host: string | null | undefined, protocol: string | null | undefined): string | null {
  const normalizedHost = host?.trim();
  const normalizedProtocol = protocol?.trim().toLowerCase();
  if (
    !normalizedHost
    || (normalizedProtocol !== "http" && normalizedProtocol !== "https")
    || /[,/\\@?#\s]/.test(normalizedHost)
  ) return null;
  return normalizeOrigin(`${normalizedProtocol}://${normalizedHost}`, `${normalizedProtocol}:`);
}

function replitOriginFromDomain(domain: string | null | undefined): string | null {
  const normalizedDomain = domain?.trim();
  if (!normalizedDomain) return null;
  return normalizedDomain.includes("://")
    ? normalizeOrigin(normalizedDomain, "https:")
    : originFromHost(normalizedDomain, "https");
}

function firstHeaderValue(value: string): string | null {
  return value.split(",", 1)[0]?.trim() || null;
}

export type SameOriginDiagnostic = {
  allowed: boolean;
  originState: "missing" | "invalid" | "valid";
  requestUrlOriginAvailable: boolean;
  requestUrlMatch: boolean;
  hostHeaderPresent: boolean;
  forwardedHostHeaderPresent: boolean;
  forwardedProtocolHeaderPresent: boolean;
  proxyOriginAvailable: boolean;
  proxyMatch: boolean;
  replitDomainsConfigured: boolean;
  replitDomainCount: number;
  replitDomainValidCount: number;
  replitDomainMatch: boolean;
  replitDevDomainConfigured: boolean;
  replitDevDomainValid: boolean;
  replitDevDomainMatch: boolean;
};

export function diagnoseSameOrigin(request: Request): SameOriginDiagnostic {
  const originHeader = request.headers.get("origin");
  const requestOrigin = normalizeOrigin(originHeader);
  const originState = originHeader?.trim()
    ? requestOrigin ? "valid" : "invalid"
    : "missing";

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set<string>();
  const urlOrigin = normalizeOrigin(requestUrl.origin);
  if (urlOrigin) allowedOrigins.add(urlOrigin);

  const forwardedHostHeader = request.headers.get("x-forwarded-host");
  const host = forwardedHostHeader === null
    ? request.headers.get("host")
    : firstHeaderValue(forwardedHostHeader);
  const forwardedProtocolHeader = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocolHeader === null
    ? requestUrl.protocol.replace(":", "")
    : firstHeaderValue(forwardedProtocolHeader);
  const proxyOrigin = originFromHost(host, protocol);
  if (proxyOrigin) allowedOrigins.add(proxyOrigin);

  const replitDomainsValue = process.env.REPLIT_DOMAINS;
  const replitDomains = replitDomainsValue?.split(",") ?? [];
  const replitOrigins = replitDomains
    .map((domain) => replitOriginFromDomain(domain))
    .filter((origin): origin is string => origin !== null);
  for (const replitOrigin of replitOrigins) {
    allowedOrigins.add(replitOrigin);
  }
  const replitDevDomainValue = process.env.REPLIT_DEV_DOMAIN;
  const developmentOrigin = replitOriginFromDomain(replitDevDomainValue);
  if (developmentOrigin) allowedOrigins.add(developmentOrigin);

  const requestUrlMatch = Boolean(requestOrigin && urlOrigin === requestOrigin);
  const proxyMatch = Boolean(requestOrigin && proxyOrigin === requestOrigin);
  const replitDomainMatch = Boolean(requestOrigin && replitOrigins.includes(requestOrigin));
  const replitDevDomainMatch = Boolean(requestOrigin && developmentOrigin === requestOrigin);

  return {
    allowed: Boolean(requestOrigin && allowedOrigins.has(requestOrigin)),
    originState,
    requestUrlOriginAvailable: urlOrigin !== null,
    requestUrlMatch,
    hostHeaderPresent: request.headers.has("host"),
    forwardedHostHeaderPresent: forwardedHostHeader !== null,
    forwardedProtocolHeaderPresent: forwardedProtocolHeader !== null,
    proxyOriginAvailable: proxyOrigin !== null,
    proxyMatch,
    replitDomainsConfigured: Boolean(replitDomainsValue?.trim()),
    replitDomainCount: replitDomains.length,
    replitDomainValidCount: replitOrigins.length,
    replitDomainMatch,
    replitDevDomainConfigured: Boolean(replitDevDomainValue?.trim()),
    replitDevDomainValid: developmentOrigin !== null,
    replitDevDomainMatch,
  };
}

export function sameOrigin(request: Request): boolean {
  return diagnoseSameOrigin(request).allowed;
}
