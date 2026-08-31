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
  page("face", "顔つけ", "beginner"),
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
  it("未選択では4コースの選択と全体資料だけを表示する", async () => {
    const { default: CoachingPage } = await import("../app/(protected)/coaching/page");
    const html = renderToStaticMarkup(await CoachingPage({ searchParams: Promise.resolve({}) }));
    const imageSources = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g), (match) => match[1]);

    expect(imageSources).toEqual([
      "/images/coaching/coaching-philosophy.jpg",
      "/images/coaching/course-map.jpg",
    ]);
    expect(html).toContain("担当コースを選んでください");
    expect(html).toContain("course=beginner");
    expect(html).toContain("course=challenge");
    expect(html).not.toContain("顔つけ");
    expect(html.indexOf("指導の全体像を見る")).toBeLessThan(html.indexOf('aria-label="コースを選ぶ"'));
  });

  it("選択したコースの種目と資料だけを表示する", async () => {
    const { default: CoachingPage } = await import("../app/(protected)/coaching/page");
    const html = renderToStaticMarkup(await CoachingPage({
      searchParams: Promise.resolve({ course: "beginner" }),
    }));
    const imageSources = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g), (match) => match[1]);

    expect(imageSources).toEqual([
      "/images/coaching/coaching-philosophy.jpg",
      "/images/coaching/course-map.jpg",
      "/images/coaching/beginner-course.jpg",
    ]);
    expect(html).toContain("初級コースの種目から");
    expect(html).toContain("顔つけ");
    expect(html).not.toContain("intermediate-course.jpg");
    expect(html.indexOf("coaching-course__poster")).toBeLessThan(html.indexOf("確認する種目を選ぶ"));
    expect(html).not.toContain('<details class="coaching-course__poster">');
  });

  it("不正なコース指定は未選択として扱う", async () => {
    const { default: CoachingPage } = await import("../app/(protected)/coaching/page");
    const html = renderToStaticMarkup(await CoachingPage({
      searchParams: Promise.resolve({ course: "unknown" }),
    }));

    expect(html).toContain("担当コースを選んでください");
    expect(html).not.toContain("選択中のコース");
  });
});
