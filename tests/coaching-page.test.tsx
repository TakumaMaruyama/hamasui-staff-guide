import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ManualPage, ManualSnapshot } from "../src/types/manual";

const page = (id: string, title: string, parentId?: string): ManualPage => ({
  id,
  title,
  slug: id,
  ...(parentId ? { parentId } : {}),
  breadcrumbs: [],
  plainText: "",
  headings: [],
  blocks: [],
});

const pages = [
  page("beginner", "初級", "root"),
  page("intermediate", "中級", "root"),
  page("advanced", "上級", "root"),
  page("challenge", "チャレンジ", "root"),
];

const snapshot: ManualSnapshot = {
  rootPageId: "root",
  syncedAt: "2026-08-30T00:00:00Z",
  pages: [
    {
      ...page("root", "スタッフガイド"),
      blocks: [{
        id: "coaching-database",
        type: "child_database",
        title: "B業務DB",
        isLoaded: true,
        children: pages.map((item) => ({
          id: `link-${item.id}`,
          type: "child_page" as const,
          title: item.title,
          pageId: item.id,
          slug: item.slug,
          children: [],
        })),
      }],
    },
    ...pages,
  ],
};

vi.mock("@/src/lib/manuals/server", () => ({
  loadManualSnapshot: vi.fn(async () => ({
    ok: true,
    data: { snapshot, source: "live" },
  })),
}));

describe("指導を探す画面", () => {
  it("全体資料と各コース資料を対応順に表示する", async () => {
    const { default: CoachingPage } = await import("../app/(protected)/coaching/page");
    const html = renderToStaticMarkup(await CoachingPage());
    const imageSources = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g), (match) => match[1]);

    expect(imageSources).toEqual([
      "/images/coaching/coaching-philosophy.jpg",
      "/images/coaching/course-map.jpg",
      "/images/coaching/beginner-course.jpg",
      "/images/coaching/intermediate-course.jpg",
      "/images/coaching/advanced-course.jpg",
      "/images/coaching/challenge-course.jpg",
    ]);
    expect(html).toContain("指導の全体像");
    expect(html).toContain("初級コース");
    expect(html).toContain("チャレンジコース");
  });
});
