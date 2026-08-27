import { describe, expect, it } from "vitest";
import { highlightSearchText, normalizeSearchText, searchManual } from "../src/lib/search/manual-search";
import type { ManualSnapshot } from "../src/types/manual";

const snapshot: ManualSnapshot = {
  rootPageId: "root",
  syncedAt: "2026-01-01T00:00:00.000Z",
  pages: [
    { id: "title", title: "安全管理", slug: "safety", breadcrumbs: [], plainText: "プールのルール", headings: [], blocks: [] },
    { id: "heading", title: "コース", slug: "course", breadcrumbs: [], plainText: "本文", headings: [{ id: "h", text: "安全 の基準", level: 2 }], blocks: [] },
    { id: "body", title: "業務", slug: "work", breadcrumbs: [], plainText: "入水前に安全確認をします", headings: [], blocks: [] },
  ],
};

describe("manual search", () => {
  it("normalizes NFKC Japanese queries and ranks title, heading, then body", () => {
    expect(normalizeSearchText("  ＡＢＣ　安全  ")).toBe("abc 安全");
    expect(searchManual(snapshot, "安全").map((result) => result.matchedIn)).toEqual(["title", "heading", "body"]);
  });

  it("requires every query term and supplies highlight-ready excerpts", () => {
    const result = searchManual(snapshot, "入水 安全")[0];
    expect(result.page.id).toBe("body");
    expect(result.excerptParts.some((part) => part.highlighted)).toBe(true);
    expect(highlightSearchText("安全確認", ["安全"])).toEqual([{ text: "安全", highlighted: true }, { text: "確認", highlighted: false }]);
  });

  it("preserves the original manual text in highlighted excerpts", () => {
    expect(highlightSearchText("ＡＢＣ　安全", ["abc"])).toEqual([
      { text: "ＡＢＣ", highlighted: true },
      { text: "　安全", highlighted: false },
    ]);
  });

  it("finds queries whose terms are split across title and body", () => {
    expect(searchManual(snapshot, "業務 安全")[0]).toMatchObject({
      page: { id: "body" },
      matchedIn: "multiple",
    });
  });

  it("keeps normalized search data scoped to each snapshot", () => {
    const refreshed = { ...snapshot, pages: [{ ...snapshot.pages[0], title: "研修" }] };
    expect(searchManual(snapshot, "安全")[0]?.page.id).toBe("title");
    expect(searchManual(refreshed, "研修")[0]?.page.id).toBe("title");
    expect(searchManual(refreshed, "安全").some((result) => result.page.id === "title")).toBe(false);
  });
});
