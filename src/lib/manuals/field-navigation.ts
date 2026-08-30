import { blockAnchorId } from "@/src/lib/manuals/presentation";
import type { ManualBlock, ManualPage, ManualSnapshot } from "@/src/types/manual";

export type FieldManualGroupKey = "before" | "coaching" | "after" | "guardian" | "intro" | "other";

export type FieldManualGroup = {
  key: FieldManualGroupKey;
  title: string;
  pages: ManualPage[];
  sourceTitle?: string;
};

const GROUPS: Array<{ key: FieldManualGroupKey; title: string; aliases: string[] }> = [
  { key: "before", title: "指導前の業務", aliases: ["指導前", "A業務"] },
  { key: "coaching", title: "水泳指導", aliases: ["水泳指導", "B業務"] },
  { key: "after", title: "指導後の業務", aliases: ["指導後", "C業務"] },
  { key: "guardian", title: "保護者対応", aliases: ["保護者対応", "D業務"] },
  { key: "intro", title: "はじめに", aliases: ["はじめに", "0.", "新規データベース"] },
];

/** Stable aliases for the current read-only Notion databases. */
export const MANUAL_DATABASE_GROUP_ALIASES: Readonly<Record<string, FieldManualGroupKey>> = {
  "249399527efd8012810debb2dbf11eec": "intro",
  "248399527efd81aaae48ee6b0196a7d7": "before",
  "248399527efd81149fcefa006d5208cc": "coaching",
  "248399527efd812ab290d20f6ae4dfdb": "after",
  "248399527efd81dd8fd8fbca7c91a3f7": "guardian",
  "24b399527efd808e8f22dd52ae4e7b1a": "other",
};

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/[\s.．・:：/_-]/g, "").toLowerCase();
}

function groupForTitle(title: string): (typeof GROUPS)[number] | undefined {
  const value = normalize(title);
  if (value.includes(normalize("D業務DB(1)")) || value.includes(normalize("5.その他"))) return undefined;
  return GROUPS.find((group) => group.aliases.some((alias) => value.includes(normalize(alias))));
}

function databaseGroup(database: Extract<ManualBlock, { type: "child_database" }>) {
  const key = MANUAL_DATABASE_GROUP_ALIASES[database.id.replace(/-/g, "").toLowerCase()];
  if (key) return GROUPS.find((group) => group.key === key);
  return groupForTitle(database.title);
}

function walk(blocks: ManualBlock[]): ManualBlock[] {
  return blocks.flatMap((block) => [block, ...walk(block.children)]);
}

function databaseBlocks(root: ManualPage): Extract<ManualBlock, { type: "child_database" }>[] {
  return walk(root.blocks).filter(
    (block): block is Extract<ManualBlock, { type: "child_database" }> => block.type === "child_database",
  );
}

/** Groups are a presentation projection; the Notion snapshot is never mutated. */
export function fieldManualGroups(snapshot: ManualSnapshot): FieldManualGroup[] {
  const root = snapshot.pages.find((page) => page.id === snapshot.rootPageId) ?? snapshot.pages[0];
  if (!root) return [];
  const byId = new Map(snapshot.pages.map((page) => [page.id, page]));
  const used = new Set<string>();
  const discoveredGroups = databaseBlocks(root).map((database) => {
    const match = databaseGroup(database);
    const pages = database.children.flatMap((block) => {
      if (block.type !== "child_page") return [];
      const page = byId.get(block.pageId);
      if (page) used.add(page.id);
      return page ? [page] : [];
    });
    return {
      key: match?.key ?? "other",
      title: match?.title ?? (database.title || "その他"),
      pages,
      ...(database.title ? { sourceTitle: database.title } : {}),
    };
  });
  const knownGroups = GROUPS.map((definition) => {
    const matches = discoveredGroups.filter((group) => group.key === definition.key);
    return {
      key: definition.key,
      title: definition.title,
      pages: matches.flatMap((group) => group.pages),
      ...(matches[0]?.sourceTitle ? { sourceTitle: matches[0].sourceTitle } : {}),
    } satisfies FieldManualGroup;
  });
  // Unknown databases stay separate so their current Notion names remain visible.
  const otherGroups = discoveredGroups.filter((group) => group.key === "other");
  if (otherGroups.length === 0) otherGroups.push({ key: "other", title: "その他", pages: [] });
  const otherGroup = otherGroups[0];
  const ungrouped = snapshot.pages.filter((page) => page.id !== root.id && !used.has(page.id) && !page.parentId);
  if (ungrouped.length > 0) {
    otherGroup.pages.push(...ungrouped);
  }
  return [...knownGroups, ...otherGroups];
}

function descendants(snapshot: ManualSnapshot, page: ManualPage): ManualPage[] {
  const result: ManualPage[] = [];
  const children = snapshot.pages.filter((candidate) => candidate.parentId === page.id);
  for (const child of children) result.push(child, ...descendants(snapshot, child));
  return result;
}

const COURSE_NAMES = ["初級", "中級", "上級", "チャレンジ"] as const;
export type CoachingCourse = {
  title: (typeof COURSE_NAMES)[number];
  page?: ManualPage;
  pages: ManualPage[];
};

export function coachingCourses(snapshot: ManualSnapshot): { courses: CoachingCourse[]; hints: ManualPage[] } {
  const group = fieldManualGroups(snapshot).find((item) => item.key === "coaching");
  const pages = group?.pages ?? [];
  const courses = COURSE_NAMES.map((title) => {
    const page = pages.find((item) => item.title.trim() === title || item.title.trim().startsWith(`${title}コース`));
    return { title, page, pages: page ? descendants(snapshot, page) : [] };
  });
  const courseIds = new Set(courses.flatMap((course) => [course.page?.id, ...course.pages.map((page) => page.id)].filter(Boolean)));
  return { courses, hints: pages.filter((page) => !courseIds.has(page.id)) };
}

const EMERGENCY_LINKS = [
  { label: "心肺蘇生法", keywords: ["心肺蘇生", "CPR"] },
  { label: "溺水時", keywords: ["溺水"] },
  { label: "災害時", keywords: ["災害", "地震", "火災"] },
  { label: "不審者対応", keywords: ["不審者"] },
] as const;

export function emergencyPage(snapshot: ManualSnapshot): ManualPage | undefined {
  return snapshot.pages.find((page) => page.title.trim() === "緊急時対応");
}

export function emergencyLinks(page: ManualPage | undefined): Array<{ label: string; href: string; heading?: string }> {
  if (!page) return EMERGENCY_LINKS.map(({ label }) => ({ label, href: "#" }));
  return EMERGENCY_LINKS.map(({ label, keywords }) => {
    const heading = page.headings.find((item) => keywords.some((keyword) => item.text.includes(keyword)));
    return { label, href: heading ? `#${blockAnchorId(heading.id)}` : "#", ...(heading ? { heading: heading.text } : {}) };
  });
}
