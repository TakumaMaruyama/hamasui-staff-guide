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

export function sameOrigin(request: Request): boolean {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  if (!requestOrigin) return false;

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

  for (const domain of process.env.REPLIT_DOMAINS?.split(",") ?? []) {
    const replitOrigin = replitOriginFromDomain(domain);
    if (replitOrigin) allowedOrigins.add(replitOrigin);
  }
  const developmentOrigin = replitOriginFromDomain(process.env.REPLIT_DEV_DOMAIN);
  if (developmentOrigin) allowedOrigins.add(developmentOrigin);

  return allowedOrigins.has(requestOrigin);
}
