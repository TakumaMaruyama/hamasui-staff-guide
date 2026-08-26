import type {
  ManualBlock,
  ManualHeading,
  ManualMedia,
  ManualPage,
  ManualRichText,
  ManualTextStyle,
} from "@/src/types/manual";
import type { NotionRecord } from "./gateway";

const EMPTY_STYLE: ManualTextStyle = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  color: "default",
};

function record(value: unknown): NotionRecord {
  return value !== null && typeof value === "object" ? (value as NotionRecord) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function richTextFromNotion(value: unknown): ManualRichText[] {
  return array(value).map((item) => {
    const source = record(item);
    const annotations = record(source.annotations);
    const content = record(source.text);
    return {
      text: text(source.plain_text) || text(content.content),
      ...(text(source.href) ? { href: text(source.href) } : {}),
      style: {
        bold: annotations.bold === true,
        italic: annotations.italic === true,
        underline: annotations.underline === true,
        strikethrough: annotations.strikethrough === true,
        code: annotations.code === true,
        color: text(annotations.color) || EMPTY_STYLE.color,
      },
    };
  });
}

export function richTextToPlainText(value: ManualRichText[]): string {
  return value.map((part) => part.text).join("");
}

function mediaFromNotion(value: unknown): ManualMedia {
  const source = record(value);
  const file = record(source.file);
  const external = record(source.external);
  return {
    ...(text(file.url) || text(external.url) ? { url: text(file.url) || text(external.url) } : {}),
    ...(text(source.name) ? { name: text(source.name) } : {}),
    caption: richTextFromNotion(source.caption),
  };
}

function iconText(value: unknown): string | undefined {
  const icon = record(value);
  return text(icon.emoji) || undefined;
}

export function blockTitle(block: NotionRecord): string {
  const kind = text(block.type);
  return text(record(block[kind]).title);
}

/** Converts one Notion block while preserving an internal discriminated union. */
export function blockFromNotion(
  source: NotionRecord,
  children: ManualBlock[] = [],
  childPageSlug?: string,
): ManualBlock {
  const id = text(source.id) || "unknown-block";
  const type = text(source.type);
  const content = record(source[type]);
  const base = { id, children };
  const richText = richTextFromNotion(content.rich_text);
  const color = text(content.color) || undefined;

  switch (type) {
    case "paragraph":
    case "bulleted_list_item":
    case "numbered_list_item":
    case "toggle":
    case "quote":
      return { ...base, type, richText, ...(color ? { color } : {}) };
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return {
        ...base,
        type,
        richText,
        ...(color ? { color } : {}),
        isToggleable: content.is_toggleable === true,
      };
    case "to_do":
      return { ...base, type, richText, checked: content.checked === true, ...(color ? { color } : {}) };
    case "callout":
      return {
        ...base,
        type,
        richText,
        ...(color ? { color } : {}),
        ...(iconText(content.icon) ? { icon: iconText(content.icon) } : {}),
      };
    case "divider":
      return { ...base, type };
    case "image":
    case "video":
    case "file":
    case "pdf":
      return { ...base, type, media: mediaFromNotion(content) };
    case "bookmark":
      return { ...base, type, ...(text(content.url) ? { url: text(content.url) } : {}), caption: richTextFromNotion(content.caption) };
    case "code":
      return { ...base, type, richText, caption: richTextFromNotion(content.caption), ...(text(content.language) ? { language: text(content.language) } : {}) };
    case "table":
      return {
        ...base,
        type,
        width: typeof content.table_width === "number" ? content.table_width : 0,
        hasColumnHeader: content.has_column_header === true,
        hasRowHeader: content.has_row_header === true,
      };
    case "table_row":
      return { ...base, type, cells: array(content.cells).map(richTextFromNotion) };
    case "column_list":
    case "column":
    case "synced_block":
      return { ...base, type };
    case "child_page":
      return { ...base, type, title: text(content.title) || "無題のページ", pageId: id, slug: childPageSlug || createSlug(text(content.title), id) };
    case "child_database":
      return { ...base, type, title: text(content.title) || "データベース", isLoaded: false };
    default:
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Unsupported Notion block type: ${type || "unknown"}`);
      }
      return { ...base, type: "unsupported", originalType: type || "unknown" };
  }
}

export function createSlug(title: string, id: string): string {
  const normalized = title.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
  const slug = normalized
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `manual-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "page"}`;
}

function visitBlocks(blocks: ManualBlock[], visitor: (block: ManualBlock) => void): void {
  for (const block of blocks) {
    visitor(block);
    visitBlocks(block.children, visitor);
  }
}

export function headingsFromBlocks(blocks: ManualBlock[]): ManualHeading[] {
  const headings: ManualHeading[] = [];
  visitBlocks(blocks, (block) => {
    if (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") {
      headings.push({ id: block.id, text: richTextToPlainText(block.richText), level: Number(block.type.slice(-1)) as 1 | 2 | 3 });
    }
  });
  return headings;
}

export function plainTextFromBlocks(blocks: ManualBlock[]): string {
  const parts: string[] = [];
  visitBlocks(blocks, (block) => {
    if ("richText" in block) parts.push(richTextToPlainText(block.richText));
    if (block.type === "table_row") block.cells.forEach((cell) => parts.push(richTextToPlainText(cell)));
    if (block.type === "bookmark") parts.push(richTextToPlainText(block.caption));
    if (block.type === "image" || block.type === "video" || block.type === "file" || block.type === "pdf") parts.push(richTextToPlainText(block.media.caption));
  });
  return parts.filter(Boolean).join("\n");
}

export function pageFromBlocks(input: Omit<ManualPage, "plainText" | "headings">): ManualPage {
  return { ...input, headings: headingsFromBlocks(input.blocks), plainText: plainTextFromBlocks(input.blocks) };
}
