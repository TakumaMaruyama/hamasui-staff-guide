import { afterEach, describe, expect, it } from "vitest";
import { POST as login } from "../app/api/auth/login/route";
import { createSessionToken, safeReturnTo, sameOrigin, verifySessionToken } from "../src/lib/auth/session";

const originalSecret = process.env.SESSION_SECRET;
const originalPassword = process.env.STAFF_SITE_PASSWORD;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
  if (originalPassword === undefined) delete process.env.STAFF_SITE_PASSWORD;
  else process.env.STAFF_SITE_PASSWORD = originalPassword;
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
  });

  it("Replit等の信頼できるproxyヘッダーを使って同一originを確認する", () => {
    const request = new Request("http://127.0.0.1:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://staff.example",
        "x-forwarded-host": "staff.example",
        "x-forwarded-proto": "https",
      },
    });
    expect(sameOrigin(request)).toBe(true);
    expect(sameOrigin(new Request(request.url, { method: "POST", headers: { origin: "https://evil.example" } }))).toBe(false);
  });

  it("内部のlisten先ではなく利用者がアクセスしたoriginへ遷移する", async () => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.STAFF_SITE_PASSWORD = "staff-password";
    const form = new FormData();
    form.set("password", "staff-password");
    form.set("returnTo", "/manuals");
    const response = await login(new Request("http://0.0.0.0:3100/api/auth/login", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
      },
      body: form,
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3100/manuals");
  });
});
