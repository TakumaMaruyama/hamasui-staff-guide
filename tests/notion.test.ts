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
      retrieveDatabase: async () => ({}),
      queryDataSource: async () => ({ results: [], hasMore: false }),
    };
    const result = await new NotionManualRepository({ gateway, rootPageId: "root" }).getSnapshot();
    expect(result.snapshot.pages).toHaveLength(2);
    expect(result.snapshot.pages[0].blocks[0].children[0].type).toBe("paragraph");
    expect(result.snapshot.pages[1]).toMatchObject({ parentId: "root", breadcrumbs: [{ title: "スタッフガイド" }] });
    expect(result.snapshot.pages[0].blocks[1]).toMatchObject({ type: "child_page", slug: result.snapshot.pages[1].slug });
  });

  it("fetches paginated child database rows as navigable manual pages", async () => {
    const page = (id: string, title: string) => ({
      object: "page",
      id,
      properties: { Name: { type: "title", title: rich(title) } },
      last_edited_time: "2026-08-26T00:00:00.000Z",
    });
    const listBlockChildren = vi.fn(async (id: string) => ({
      results: id === "root"
        ? [{ id: "database", type: "child_database", child_database: { title: "A業務マニュアルDB" }, has_children: true }]
        : [{ id: id + "-body", type: "paragraph", paragraph: { rich_text: rich(id + "の本文") }, has_children: false }],
      hasMore: false,
    }));
    const queryDataSource = vi.fn(async (_id: string, cursor?: string) => cursor
      ? { results: [page("second", "安全確認")], hasMore: false }
      : { results: [page("first", "開館作業")], hasMore: true, nextCursor: "next" });
    const gateway = {
      retrievePage: async (id: string) => page(id, id === "root" ? "スタッフガイド" : id),
      listBlockChildren,
      retrieveDatabase: async () => ({
        object: "database",
        id: "database",
        data_sources: [{ id: "source", name: "A業務マニュアルDB" }],
      }),
      queryDataSource,
    };

    const result = await new NotionManualRepository({ gateway, rootPageId: "root" }).getSnapshot();
    const databaseBlock = result.snapshot.pages[0].blocks[0];

    expect(result.snapshot.pages.map((manual) => manual.title)).toEqual([
      "スタッフガイド",
      "開館作業",
      "安全確認",
    ]);
    expect(result.snapshot.pages.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentId: "root", breadcrumbs: [{ title: "スタッフガイド", slug: "スタッフガイド", id: "root" }] }),
    ]));
    expect(databaseBlock).toMatchObject({
      type: "child_database",
      isLoaded: true,
      children: [
        { type: "child_page", title: "開館作業", slug: "開館作業" },
        { type: "child_page", title: "安全確認", slug: "安全確認" },
      ],
    });
    expect(queryDataSource).toHaveBeenNthCalledWith(1, "source", undefined);
    expect(queryDataSource).toHaveBeenNthCalledWith(2, "source", "next");
    expect(listBlockChildren.mock.calls.map(([id]) => id)).not.toContain("database");
  });

  it("resolves page shortcuts while keeping unavailable and non-page targets safe", async () => {
    const page = (id: string, title: string) => ({
      object: "page",
      id,
      properties: { Name: { type: "title", title: rich(title) } },
    });
    const retrievePage = vi.fn(async (id: string) => {
      if (id === "missing") throw new Error("not shared");
      return page(id, id === "root" ? "スタッフガイド" : "上級コース");
    });
    const listBlockChildren = vi.fn(async (id: string) => ({
      results: id === "root"
        ? [
          { id: "shortcut", type: "link_to_page", link_to_page: { type: "page_id", page_id: "advanced" }, has_children: false },
          { id: "missing-shortcut", type: "link_to_page", link_to_page: { type: "page_id", page_id: "missing" }, has_children: false },
          { id: "database-shortcut", type: "link_to_page", link_to_page: { type: "database_id", database_id: "database" }, has_children: false },
        ]
        : [{ id: "advanced-body", type: "paragraph", paragraph: { rich_text: rich("上級者向けの内容") }, has_children: false }],
      hasMore: false,
    }));
    const gateway: NotionGateway = {
      retrievePage,
      listBlockChildren,
      retrieveDatabase: async () => ({}),
      queryDataSource: async () => ({ results: [], hasMore: false }),
    };

    const result = await new NotionManualRepository({ gateway, rootPageId: "root" }).getSnapshot();

    expect(result.snapshot.pages.map((manual) => manual.title)).toEqual(["スタッフガイド", "上級コース"]);
    expect(result.snapshot.pages[0].blocks[0]).toMatchObject({
      type: "link_to_page",
      targetType: "page_id",
      targetId: "advanced",
      title: "上級コース",
      slug: "上級コース",
    });
    expect(result.snapshot.pages[0].blocks[1]).toMatchObject({
      type: "link_to_page",
      targetId: "missing",
    });
    expect(result.snapshot.pages[0].blocks[1]).not.toHaveProperty("slug");
    expect(result.snapshot.pages[1]).toMatchObject({
      title: "上級コース",
      plainText: "上級者向けの内容",
      breadcrumbs: [],
    });
    expect(retrievePage).not.toHaveBeenCalledWith("database");
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
    expect((await cache.get(async () => { throw new Error("offline"); }, true)).warning).toBe("stale-fallback");
  });

  it("returns an expired snapshot immediately and starts only one background refresh", async () => {
    let now = 0;
    let resolveRefresh!: (snapshot: { rootPageId: string; pages: never[]; syncedAt: string }) => void;
    const cache = new ManualSnapshotCache({ ttlMs: 1, now: () => now });
    const first = { rootPageId: "root", pages: [], syncedAt: "first" };
    const loader = vi.fn(() => new Promise<typeof first>((resolve) => { resolveRefresh = resolve; }));
    await cache.get(async () => first);

    now = 2;
    await expect(cache.get(loader)).resolves.toMatchObject({ snapshot: first, source: "cache" });
    await expect(cache.get(loader)).resolves.toMatchObject({ snapshot: first, source: "cache" });
    expect(loader).toHaveBeenCalledTimes(1);

    resolveRefresh({ ...first, syncedAt: "second" });
    await vi.waitFor(() => expect(cache.get(async () => first)).resolves.toMatchObject({ source: "cache", snapshot: { syncedAt: "second" } }));
  });

  it("waits for a forced refresh while regular readers keep the current snapshot", async () => {
    let now = 0;
    let resolveRefresh!: (snapshot: { rootPageId: string; pages: never[]; syncedAt: string }) => void;
    const cache = new ManualSnapshotCache({ ttlMs: 100, refreshCooldownMs: 30, now: () => now });
    const first = { rootPageId: "root", pages: [], syncedAt: "first" };
    const loader = vi.fn(() => new Promise<typeof first>((resolve) => { resolveRefresh = resolve; }));
    await cache.get(async () => first);

    now = 1;
    const forced = cache.get(loader, true);
    await expect(cache.get(async () => ({ ...first, syncedAt: "unexpected" }))).resolves.toMatchObject({ source: "cache", snapshot: first });
    expect(loader).toHaveBeenCalledTimes(1);

    resolveRefresh({ ...first, syncedAt: "second" });
    await expect(forced).resolves.toMatchObject({ source: "fresh", snapshot: { syncedAt: "second" } });
  });

  it("keeps a failed background refresh visible as stale data until a later refresh recovers", async () => {
    let now = 0;
    const cache = new ManualSnapshotCache({ ttlMs: 1, automaticRetryCooldownMs: 30, now: () => now });
    const first = { rootPageId: "root", pages: [], syncedAt: "first" };
    const failedLoader = vi.fn(async () => { throw new Error("offline"); });
    await cache.get(async () => first);

    now = 2;
    await expect(cache.get(failedLoader)).resolves.toMatchObject({ source: "cache", snapshot: first });
    await vi.waitFor(() => expect(failedLoader).toHaveBeenCalledTimes(1));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const recovery = vi.fn(async () => ({ ...first, syncedAt: "second" }));
    await expect(cache.get(recovery)).resolves.toMatchObject({ source: "stale", warning: "stale-fallback", snapshot: first });
    expect(recovery).not.toHaveBeenCalled();

    now = 32;
    await expect(cache.get(recovery)).resolves.toMatchObject({ source: "stale", warning: "stale-fallback", snapshot: first });
    await vi.waitFor(() => expect(recovery).toHaveBeenCalledTimes(1));
    await new Promise<void>((resolve) => setImmediate(resolve));
    await expect(cache.get(async () => first)).resolves.toMatchObject({ source: "cache", snapshot: { syncedAt: "second" } });
  });
});
