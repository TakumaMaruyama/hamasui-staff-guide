import { afterEach, describe, expect, it } from "vitest";
import { sameOrigin } from "../src/lib/security/origin";

const originalReplitDomains = process.env.REPLIT_DOMAINS;
const originalReplitDevDomain = process.env.REPLIT_DEV_DOMAIN;

afterEach(() => {
  if (originalReplitDomains === undefined) delete process.env.REPLIT_DOMAINS;
  else process.env.REPLIT_DOMAINS = originalReplitDomains;
  if (originalReplitDevDomain === undefined) delete process.env.REPLIT_DEV_DOMAIN;
  else process.env.REPLIT_DEV_DOMAIN = originalReplitDevDomain;
});

describe("same-origin request protection", () => {
  it("request URLとOriginが同じなら許可する", () => {
    expect(sameOrigin(new Request("https://staff.example/api/manuals/refresh", {
      method: "POST",
      headers: { origin: "https://staff.example" },
    }))).toBe(true);
    expect(sameOrigin(new Request("http://localhost:3000/api/manuals/refresh", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }))).toBe(true);
  });

  it("proxyヘッダーの先頭値とHostのポートを使う", () => {
    const requestUrl = "http://0.0.0.0:3000/api/manuals/refresh";
    expect(sameOrigin(new Request(requestUrl, {
      method: "POST",
      headers: {
        origin: "https://staff.example/",
        "x-forwarded-host": "STAFF.EXAMPLE:443, evil.example",
        "x-forwarded-proto": "HTTPS, http",
      },
    }))).toBe(true);
    expect(sameOrigin(new Request(requestUrl, {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
      },
    }))).toBe(true);
  });

  it("内部URLでもReplitの公開HTTPS Originを許可する", () => {
    process.env.REPLIT_DOMAINS = " FIRST.replit.app:443, , https://second.replit.app/ ";
    process.env.REPLIT_DEV_DOMAIN = "staff-guide.replit.dev";
    const requestUrl = "http://0.0.0.0:3000/api/manuals/refresh";

    expect(sameOrigin(new Request(requestUrl, {
      headers: { origin: "https://first.replit.app" },
    }))).toBe(true);
    expect(sameOrigin(new Request(requestUrl, {
      headers: { origin: "https://second.replit.app" },
    }))).toBe(true);
    expect(sameOrigin(new Request(requestUrl, {
      headers: { origin: "https://staff-guide.replit.dev" },
    }))).toBe(true);
  });

  it("外部Origin、Originなし、未設定時の公開Originを拒否する", () => {
    process.env.REPLIT_DOMAINS = "staff-guide.replit.app";
    const requestUrl = "http://0.0.0.0:3000/api/manuals/refresh";

    expect(sameOrigin(new Request(requestUrl, {
      headers: { origin: "https://evil.example" },
    }))).toBe(false);
    expect(sameOrigin(new Request(requestUrl))).toBe(false);

    delete process.env.REPLIT_DOMAINS;
    delete process.env.REPLIT_DEV_DOMAIN;
    expect(sameOrigin(new Request(requestUrl, {
      headers: { origin: "https://staff-guide.replit.app" },
    }))).toBe(false);
  });

  it("HTTPのReplit Originと不正なHost・protocol・Originを拒否する", () => {
    const requestUrl = "http://0.0.0.0:3000/api/manuals/refresh";
    process.env.REPLIT_DOMAINS = "http://staff-guide.replit.app, https://other.replit.app/path";
    process.env.REPLIT_DEV_DOMAIN = "http://staff-guide.replit.dev";

    const unsafeHeaders: Array<Record<string, string>> = [
      { origin: "http://staff-guide.replit.app" },
      { origin: "https://other.replit.app" },
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
});
