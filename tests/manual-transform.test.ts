import { describe, expect, it, vi } from "vitest";
import {
  blockFromNotion,
  headingsFromBlocks,
  richTextFromNotion,
} from "../src/lib/notion/transform";
import type { ManualBlock } from "../src/types/manual";

const rich = (text: string) => [{
  plain_text: text,
  href: "https://example.com",
  annotations: {
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    code: true,
    color: "red_background",
  },
}];

describe("Notion block transformation coverage", () => {
  it("preserves every supported rich-text annotation", () => {
    expect(richTextFromNotion(rich("確認"))[0]).toEqual({
      text: "確認",
      href: "https://example.com",
      style: {
        bold: true,
        italic: true,
        underline: true,
        strikethrough: true,
        code: true,
        color: "red_background",
      },
    });
  });

  it("converts every requested block family without throwing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const contentByType: Record<string, Record<string, unknown>> = {
      paragraph: { rich_text: rich("本文") },
      heading_1: { rich_text: rich("大見出し") },
      heading_2: { rich_text: rich("中見出し") },
      heading_3: { rich_text: rich("小見出し") },
      bulleted_list_item: { rich_text: rich("箇条書き") },
      numbered_list_item: { rich_text: rich("番号") },
      to_do: { rich_text: rich("確認"), checked: true },
      toggle: { rich_text: rich("開閉") },
      quote: { rich_text: rich("引用") },
      callout: { rich_text: rich("注意"), icon: { type: "emoji", emoji: "!" } },
      divider: {},
      image: { type: "external", external: { url: "https://example.com/image.png" }, caption: rich("画像") },
      video: { type: "external", external: { url: "https://example.com/video.mp4" }, caption: rich("動画") },
      bookmark: { url: "https://example.com", caption: rich("リンク") },
      file: { type: "external", external: { url: "https://example.com/file" }, caption: [] },
      pdf: { type: "external", external: { url: "https://example.com/file.pdf" }, caption: [] },
      code: { rich_text: rich("const ok = true"), caption: [], language: "typescript" },
      table: { table_width: 2, has_column_header: true, has_row_header: false },
      table_row: { cells: [rich("列A"), rich("列B")] },
      column_list: {},
      column: {},
      link_to_page: { type: "page_id", page_id: "linked-page" },
      child_page: { title: "子ページ" },
      child_database: { title: "一覧" },
      synced_block: {},
    };

    for (const [type, content] of Object.entries(contentByType)) {
      const block = blockFromNotion({ id: `id-${type}`, type, [type]: content });
      expect(block.type).toBe(type);
    }
    expect(blockFromNotion({ id: "unknown", type: "breadcrumb", breadcrumb: {} }).type).toBe("unsupported");
  });

  it("builds a table of contents from nested headings", () => {
    const heading = (id: string, type: "heading_1" | "heading_2" | "heading_3", text: string, children: ManualBlock[] = []) =>
      blockFromNotion({ id, type, [type]: { rich_text: rich(text) } }, children);
    const blocks = [
      heading("h1", "heading_1", "安全管理", [heading("h2", "heading_2", "入水前の確認")]),
      heading("h3", "heading_3", "緊急時"),
    ];
    expect(headingsFromBlocks(blocks)).toEqual([
      { id: "h1", text: "安全管理", level: 1 },
      { id: "h2", text: "入水前の確認", level: 2 },
      { id: "h3", text: "緊急時", level: 3 },
    ]);
  });
});
