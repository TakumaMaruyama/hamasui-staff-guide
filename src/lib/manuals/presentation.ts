import { isSafetyTitle } from "@/src/config/site";
import { richTextToPlainText } from "@/src/lib/notion/transform";
import type { ManualBlock, ManualPage, ManualSnapshot } from "@/src/types/manual";

export type ManualCategory = {
  id: string;
  title: string;
  description: string;
  href: string;
  pageCount: number;
  isSafety: boolean;
};

export function blockAnchorId(blockId: string): string {
  return `block-${blockId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function formatDate(value?: string, includeTime = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function plainTextForBlock(block: ManualBlock): string {
  if ("richText" in block) return richTextToPlainText(block.richText);
  if (block.type === "table_row") {
    return block.cells.map((cell) => richTextToPlainText(cell)).join(" ");
  }
  if (block.type === "bookmark") return richTextToPlainText(block.caption);
  if (["image", "video", "file", "pdf"].includes(block.type) && "media" in block) {
    return richTextToPlainText(block.media.caption);
  }
  return "";
}

function firstBodyText(blocks: ManualBlock[]): string {
  for (const block of blocks) {
    const value = plainTextForBlock(block).trim();
    if (value && !block.type.startsWith("heading_")) return value;
    const childValue = firstBodyText(block.children);
    if (childValue) return childValue;
  }
  return "";
}

function displayExcerpt(value: string, maxLength = 72): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function descendantCount(pageId: string, pages: ManualPage[]): number {
  const children = pages.filter((page) => page.parentId === pageId);
  return children.reduce((count, child) => count + 1 + descendantCount(child.id, pages), 0);
}

function headingSections(root: ManualPage): ManualCategory[] {
  const categories: ManualCategory[] = [];
  for (let index = 0; index < root.blocks.length; index += 1) {
    const heading = root.blocks[index];
    if (heading.type !== "heading_1") continue;
    const title = richTextToPlainText(heading.richText).trim();
    if (!title) continue;
    const sectionBlocks: ManualBlock[] = [];
    for (let cursor = index + 1; cursor < root.blocks.length; cursor += 1) {
      const next = root.blocks[cursor];
      if (next.type === "heading_1") break;
      sectionBlocks.push(next);
    }
    const childPageCount = sectionBlocks.filter((block) => block.type === "child_page").length;
    categories.push({
      id: heading.id,
      title,
      description: displayExcerpt(firstBodyText(sectionBlocks)) || "このセクションの内容を確認する",
      href: `/manual/${encodeURIComponent(root.slug)}#${blockAnchorId(heading.id)}`,
      pageCount: Math.max(1, childPageCount),
      isSafety: isSafetyTitle(title),
    });
  }
  return categories;
}

export function categoriesFromSnapshot(snapshot: ManualSnapshot): ManualCategory[] {
  const root = snapshot.pages.find((page) => page.id === snapshot.rootPageId) ?? snapshot.pages[0];
  if (!root) return [];
  const sections = headingSections(root);
  if (sections.length > 0) return sections;

  const directChildren = snapshot.pages.filter((page) => page.parentId === root.id);
  const source = directChildren.length > 0 ? directChildren : snapshot.pages;
  return source.map((page) => ({
    id: page.id,
    title: page.title,
    description: displayExcerpt(firstBodyText(page.blocks)) || "このマニュアルを確認する",
    href: `/manual/${encodeURIComponent(page.slug)}`,
    pageCount: 1 + descendantCount(page.id, snapshot.pages),
    isSafety: isSafetyTitle(page.title),
  }));
}

export function recentPages(snapshot: ManualSnapshot, limit = 5): ManualPage[] {
  return snapshot.pages
    .filter((page) => page.lastEditedTime)
    .sort(
      (left, right) =>
        new Date(right.lastEditedTime ?? 0).getTime() -
        new Date(left.lastEditedTime ?? 0).getTime(),
    )
    .slice(0, limit);
}

export function pageBySlug(snapshot: ManualSnapshot, slug: string): ManualPage | undefined {
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // Invalid path encoding cannot match a generated manual slug.
  }
  return snapshot.pages.find((page) => page.slug === decodedSlug);
}

export function pageNavigation(
  snapshot: ManualSnapshot,
  currentPage: ManualPage,
): { previous?: ManualPage; next?: ManualPage } {
  const index = snapshot.pages.findIndex((page) => page.id === currentPage.id);
  return {
    ...(index > 0 ? { previous: snapshot.pages[index - 1] } : {}),
    ...(index >= 0 && index < snapshot.pages.length - 1
      ? { next: snapshot.pages[index + 1] }
      : {}),
  };
}
