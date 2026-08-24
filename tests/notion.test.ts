import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualSnapshotCache } from "../src/lib/notion/cache";
import type { NotionGateway, NotionRecord } from "../src/lib/notion/gateway";
import { NotionManualRepository } from "../src/lib/notion/repository";
import { withNotionRetry } from "../src/lib/notion/retry";
import { blockFromNotion, richTextFromNotion } from "../src/lib/notion/transform";

const rich = (plain_text: string) => [{ plain_text, annotations: { bold: true, color: "blue" }, href: null }];

describe("Notion manual repository", () => {
  afterEach(() => vi.restoreAllMocks());
  it("follows pagination, nested children and child pages without exposing source objects", async () => {
    const page = (title: string, edited = "2026-01-01T00:00:00.000Z") => ({ properties: { Name: { type: "title", title: rich(title) } }, last_edited_time: edited });
    const children: Record<string, (cursor?: string) => { results: NotionRecord[]; hasMore: boolean; nextCursor?: string }> = {
      root: (cursor) => cursor
        ? { results: [{ id: "sub", type: "child_page", child_page: { title: "安全 管理" }, has_children: false }], hasMore: false }
        : { results: [
          { id: "heading", type: "heading_1", heading_1: { rich_text: rich("確認事項"), is_toggleable: false }, has_children: true },
        ], hasMore: true, nextCursor: "next" },
      heading: () => ({ results: [{ id: "nested", type: "paragraph", paragraph: { rich_text: rich("入水前に確認") }, has_children: false }], hasMore: false }),
      sub: () => ({ results: [{ id: "sub-text", type: "paragraph", paragraph: { rich_text: rich("緊急時の対応") }, has_children: false }], hasMore: false }),
    };
    const gateway: NotionGateway = {
      retrievePage: async (id) => page(id === "root" ? "スタッフガイド" : "安全 管理"),
      listBlockChildren: async (id, cursor) => children[id](cursor),
    };
    const result = await new NotionManualRepository({ gateway, rootPageId: "root" }).getSnapshot();
    expect(result.snapshot.pages).toHaveLength(2);
    expect(result.snapshot.pages[0].blocks[0].children[0].type).toBe("paragraph");
    expect(result.snapshot.pages[1]).toMatchObject({ parentId: "root", breadcrumbs: [{ title: "スタッフガイド" }] });
    expect(result.snapshot.pages[0].blocks[1]).toMatchObject({ type: "child_page", slug: result.snapshot.pages[1].slug });
  });

  it("converts rich text and unsupported blocks safely", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(richTextFromNotion(rich("太字"))[0]).toMatchObject({ text: "太字", style: { bold: true, color: "blue" } });
    expect(blockFromNotion({ id: "unknown", type: "breadcrumb", breadcrumb: {} })).toEqual({ id: "unknown", children: [], type: "unsupported", originalType: "breadcrumb" });
  });

  it("uses Retry-After for 429 and makes only bounded retries", async () => {
    let calls = 0;
    const waits: number[] = [];
    const value = await withNotionRetry(async () => {
      calls += 1;
      if (calls < 3) throw { status: 429, headers: { "Retry-After": "2" } };
      return "ok";
    }, { sleep: async (milliseconds) => { waits.push(milliseconds); } });
    expect(value).toBe("ok");
    expect(waits).toEqual([2000, 2000]);
  });

  it("does not shorten a Retry-After value that exceeds the fallback cap", async () => {
    const waits: number[] = [];
    let calls = 0;
    await withNotionRetry(async () => {
      calls += 1;
      if (calls === 1) throw { status: 429, headers: { "retry-after": "12" } };
      return "ok";
    }, { maxDelayMs: 8_000, sleep: async (milliseconds) => { waits.push(milliseconds); } });
    expect(waits).toEqual([12_000]);
  });

  it("returns fresh cache, enforces manual cooldown, then falls back to stale data", async () => {
    let now = 0;
    const cache = new ManualSnapshotCache({ ttlMs: 1, refreshCooldownMs: 30, now: () => now });
    const snapshot = { rootPageId: "root", pages: [], syncedAt: "first" };
    expect((await cache.get(async () => snapshot)).source).toBe("fresh");
    now = 2;
    expect((await cache.get(async () => ({ ...snapshot, syncedAt: "second" }), true)).source).toBe("fresh");
    expect((await cache.get(async () => ({ ...snapshot, syncedAt: "third" }), true)).warning).toBe("refresh-cooldown");
    now = 40;
    expect((await cache.get(async () => { throw new Error("offline"); })).warning).toBe("stale-fallback");
  });
});
