import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "../app/api/auth/login/route";
import { createSessionToken, safeReturnTo, sameOrigin, verifySessionToken } from "../src/lib/auth/session";

const originalSecret = process.env.SESSION_SECRET;
const originalPassword = process.env.STAFF_SITE_PASSWORD;
const originalReplitDomains = process.env.REPLIT_DOMAINS;
const originalReplitDevDomain = process.env.REPLIT_DEV_DOMAIN;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
  if (originalPassword === undefined) delete process.env.STAFF_SITE_PASSWORD;
  else process.env.STAFF_SITE_PASSWORD = originalPassword;
  if (originalReplitDomains === undefined) delete process.env.REPLIT_DOMAINS;
  else process.env.REPLIT_DOMAINS = originalReplitDomains;
  if (originalReplitDevDomain === undefined) delete process.env.REPLIT_DEV_DOMAIN;
  else process.env.REPLIT_DEV_DOMAIN = originalReplitDevDomain;
  vi.unstubAllEnvs();
});

describe("staff session cookie token", () => {
  it("検証可能なHMACトークンを作成する", async () => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    const token = await createSessionToken(1_700_000_000_000);
    expect(await verifySessionToken(token, 1_700_000_001_000)).toEqual({ issuedAt: 1_700_000_000, expiresAt: 1_702_592_000 });
  });

  it("改ざん・期限切れ・不正形式を拒否する", async () => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    const token = await createSessionToken(1_700_000_000_000);
    const [payload, signature] = token.split(".");
    expect(await verifySessionToken(`${payload}x.${signature}`, 1_700_000_001_000)).toBeNull();
    expect(await verifySessionToken(token, 1_702_592_000_000)).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
  });

  it("共通パスワードまたは署名秘密の更新後は旧Cookieを拒否する", async () => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    const token = await createSessionToken(1_700_000_000_000);
    process.env.STAFF_SITE_PASSWORD = "new-staff-password";
    expect(await verifySessionToken(token, 1_700_000_001_000)).toBeNull();
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    process.env.SESSION_SECRET = "new-session-secret";
    expect(await verifySessionToken(token, 1_700_000_001_000)).toBeNull();
  });

  it("returnToは同一originのパスだけ許可する", () => {
    expect(safeReturnTo("/manual?section=safety", "https://staff.example")).toBe("/manual?section=safety");
    expect(safeReturnTo("https://evil.example/steal", "https://staff.example")).toBe("/");
    expect(safeReturnTo("//evil.example/steal", "https://staff.example")).toBe("/");
    expect(safeReturnTo("/login", "https://staff.example")).toBe("/");
    expect(safeReturnTo("/api/auth/logout", "https://staff.example")).toBe("/");
    expect(safeReturnTo("/manuals", "HTTPS://STAFF.EXAMPLE:443/")).toBe("/manuals");
  });

  it("request.urlとOriginが同じなら許可する", () => {
    expect(sameOrigin(new Request("https://staff.example/api/auth/login", {
      method: "POST",
      headers: { origin: "https://staff.example" },
    }))).toBe(true);
    expect(sameOrigin(new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }))).toBe(true);
  });

  it("proxyヘッダーの先頭値とHostのポートを使って同一originを確認する", () => {
    const request = new Request("http://127.0.0.1:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://staff.example/",
        "x-forwarded-host": "STAFF.EXAMPLE:443, evil.example",
        "x-forwarded-proto": "HTTPS, http",
      },
    });
    expect(sameOrigin(request)).toBe(true);

    const hostRequest = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
      },
    });
    expect(sameOrigin(hostRequest)).toBe(true);
    expect(sameOrigin(new Request(request.url, {
      method: "POST",
      headers: {
        origin: "http://evil.example",
        "x-forwarded-host": "staff.example, evil.example",
        "x-forwarded-proto": "https, http",
      },
    }))).toBe(false);
  });

  it("内部listen先でもREPLIT_DOMAINSの公開originを許可する", () => {
    process.env.REPLIT_DOMAINS = "hamasui-staff-guide.replit.app";
    const request = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "https://hamasui-staff-guide.replit.app" },
    });
    expect(sameOrigin(request)).toBe(true);
  });

  it("複数・空白付き・URL形式のREPLIT_DOMAINSをHTTPS originとして許可する", () => {
    process.env.REPLIT_DOMAINS = " FIRST.replit.app:443, , https://second.replit.app/ ";
    const requestUrl = "http://0.0.0.0:3000/api/auth/login";
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://first.replit.app" } }))).toBe(true);
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://second.replit.app" } }))).toBe(true);
  });

  it("REPLIT_DEV_DOMAINの裸ホスト名とHTTPS URL形式を許可する", () => {
    const requestUrl = "http://0.0.0.0:3000/api/auth/login";
    process.env.REPLIT_DEV_DOMAIN = "staff-guide.replit.dev";
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://staff-guide.replit.dev" } }))).toBe(true);
    process.env.REPLIT_DEV_DOMAIN = " https://STAFF-GUIDE.replit.dev:443/ ";
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://staff-guide.replit.dev/" } }))).toBe(true);
  });

  it("許可リスト外・Originなし・未設定時の外部originを拒否する", () => {
    process.env.REPLIT_DOMAINS = "staff-guide.replit.app";
    const requestUrl = "http://0.0.0.0:3000/api/auth/login";
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://evil.example" } }))).toBe(false);
    expect(sameOrigin(new Request(requestUrl))).toBe(false);
    delete process.env.REPLIT_DOMAINS;
    delete process.env.REPLIT_DEV_DOMAIN;
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://staff-guide.replit.app" } }))).toBe(false);
  });

  it("Replit環境値のhttp URLやパス付きURLを許可しない", () => {
    const requestUrl = "http://0.0.0.0:3000/api/auth/login";
    process.env.REPLIT_DOMAINS = "http://staff-guide.replit.app, https://other.replit.app/path";
    process.env.REPLIT_DEV_DOMAIN = "http://staff-guide.replit.dev";
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "http://staff-guide.replit.app" } }))).toBe(false);
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "https://other.replit.app" } }))).toBe(false);
    expect(sameOrigin(new Request(requestUrl, { headers: { origin: "http://staff-guide.replit.dev" } }))).toBe(false);
  });

  it("大文字小文字・既定ポート・末尾スラッシュを安全に正規化する", () => {
    process.env.REPLIT_DOMAINS = "staff-guide.replit.app";
    const requestUrl = "http://0.0.0.0:3000/api/auth/login";
    expect(sameOrigin(new Request(requestUrl, {
      headers: { origin: "HTTPS://STAFF-GUIDE.REPLIT.APP:443/" },
    }))).toBe(true);
  });

  it("不正なHost・protocol・Originとproxyの2番目以降の値を拒否する", () => {
    const requestUrl = "http://0.0.0.0:3000/api/auth/login";
    const unsafeHeaders: Array<Record<string, string>> = [
      { origin: "https://staff.example/path", host: "staff.example" },
      { origin: "https://user@staff.example", host: "staff.example" },
      { origin: "javascript:alert(1)", host: "staff.example" },
      { origin: "https://staff.example", host: "staff.example/path" },
      { origin: "https://staff.example", "x-forwarded-host": "bad host, staff.example", "x-forwarded-proto": "https" },
      { origin: "https://staff.example", "x-forwarded-host": "staff.example", "x-forwarded-proto": "ftp, https" },
    ];
    for (const headers of unsafeHeaders) {
      expect(sameOrigin(new Request(requestUrl, { headers }))).toBe(false);
    }
  });

  it("許可されたReplit originと正しいパスワードで303と安全なCookieを返す", async () => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    process.env.REPLIT_DOMAINS = "hamasui-staff-guide.replit.app";
    vi.stubEnv("NODE_ENV", "production");
    const form = new FormData();
    form.set("password", "staff-password");
    form.set("returnTo", "/manuals");
    const response = await login(new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "HTTPS://HAMASUI-STAFF-GUIDE.REPLIT.APP:443/" },
      body: form,
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://hamasui-staff-guide.replit.app/manuals");
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Secure/i);
  });

  it("外部originとOriginなしのログインPOSTをパスワードに関係なく403にする", async () => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    process.env.REPLIT_DOMAINS = "hamasui-staff-guide.replit.app";

    const rejectedHeaders: Array<Record<string, string>> = [{ origin: "https://evil.example" }, {}];
    for (const headers of rejectedHeaders) {
      const form = new FormData();
      form.set("password", "staff-password");
      const response = await login(new Request("http://0.0.0.0:3000/api/auth/login", {
        method: "POST",
        headers,
        body: form,
      }));
      expect(response.status).toBe(403);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
