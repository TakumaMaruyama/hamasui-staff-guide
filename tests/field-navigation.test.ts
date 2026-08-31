import { describe, expect, it } from "vitest";
import {
  coachingCourseKeyFromParam,
  coachingCourses,
  emergencyLinks,
  emergencyPage,
  fieldManualGroups,
} from "../src/lib/manuals/field-navigation";
import type { ManualPage, ManualSnapshot } from "../src/types/manual";

const page = (id: string, title: string, parentId?: string): ManualPage => ({
  id, title, slug: id, ...(parentId ? { parentId } : {}), breadcrumbs: [], plainText: "", headings: [], blocks: [],
});
const snapshot = (blocks: ManualPage["blocks"], pages: ManualPage[]): ManualSnapshot => ({ rootPageId: "root", pages: [{ ...page("root", "root"), blocks }, ...pages], syncedAt: "2026-01-01T00:00:00Z" });

describe("field navigation projections", () => {
  it("known database aliases are ordered and unknown titles fall back", () => {
    const result = fieldManualGroups(snapshot([
      { id: "db-b", type: "child_database", title: "B業務DB", isLoaded: true, children: [{ id: "link-b", type: "child_page", title: "泳ぎ", pageId: "swim", slug: "swim", children: [] }] },
      { id: "db-x", type: "child_database", title: "現場メモ", isLoaded: true, children: [] },
    ], [page("swim", "泳ぎ", "root")]));
    expect(result.map((item) => item.key)).toEqual(["before", "coaching", "after", "guardian", "intro", "other"]);
    expect(result.find((item) => item.key === "coaching")?.pages[0].title).toBe("泳ぎ");
    expect(result.find((item) => item.key === "other")?.title).toBe("現場メモ");
  });

  it("uses stable database IDs before labels and keeps multiple unknown labels", () => {
    const result = fieldManualGroups(snapshot([
      { id: "24839952-7efd-81dd-8fd8-fbca7c91a3f7", type: "child_database", title: "現在名が変わっても", isLoaded: true, children: [] },
      { id: "unknown-a", type: "child_database", title: "現場メモA", isLoaded: true, children: [] },
      { id: "unknown-b", type: "child_database", title: "現場メモB", isLoaded: true, children: [] },
    ], []));

    expect(result.find((item) => item.key === "guardian")?.sourceTitle).toBe("現在名が変わっても");
    expect(result.filter((item) => item.key === "other").map((item) => item.title)).toEqual([
      "現場メモA",
      "現場メモB",
    ]);
  });

  it("courses include descendants and leave other B pages as hints", () => {
    const result = coachingCourses(snapshot([{ id: "db", type: "child_database", title: "B業務DB", isLoaded: true, children: [
      { id: "a", type: "child_page", title: "初級", pageId: "beginner", slug: "beginner", children: [] },
      { id: "b", type: "child_page", title: "自由泳ぎ", pageId: "free", slug: "free", children: [] },
    ] }], [page("beginner", "初級", "root"), page("free", "自由泳ぎ", "root"), page("stroke", "クロール", "beginner")]));
    expect(result.courses.map((course) => course.title)).toEqual(["初級", "中級", "上級", "チャレンジ"]);
    expect(result.courses[0].pages.map((item) => item.title)).toEqual(["クロール"]);
    expect(result.hints.map((item) => item.title)).toEqual(["自由泳ぎ"]);
  });

  it("accepts only stable coaching course query keys", () => {
    expect(coachingCourseKeyFromParam("beginner")).toBe("beginner");
    expect(coachingCourseKeyFromParam(["advanced", "challenge"])).toBe("advanced");
    expect(coachingCourseKeyFromParam("初級")).toBeUndefined();
    expect(coachingCourseKeyFromParam("unknown")).toBeUndefined();
  });

  it("emergency page is exact and links to matching heading anchors", () => {
    const emergency = { ...page("e", "緊急時対応"), headings: [
      { id: "cpr", text: "心肺蘇生法（CPR）", level: 2 as const },
      { id: "drown", text: "溺水時の対応", level: 2 as const },
      { id: "quake", text: "災害時の対応（地震・火災）", level: 2 as const },
      { id: "intruder", text: "不審者対応", level: 2 as const },
    ] };
    const snap = snapshot([], [emergency, page("almost", "緊急時対応 ")]);
    expect(emergencyPage(snap)?.id).toBe("e");
    expect(emergencyLinks(emergency).map((item) => item.label)).toEqual([
      "心肺蘇生法",
      "溺水時",
      "災害時",
      "不審者対応",
    ]);
    expect(emergencyLinks(emergency).map((item) => item.href)).toEqual(["#block-cpr", "#block-drown", "#block-quake", "#block-intruder"]);
  });
});
