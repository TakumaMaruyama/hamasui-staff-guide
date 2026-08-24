import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManualBlocks } from "../src/components/manual-blocks";
import { blockFromNotion } from "../src/lib/notion/transform";

const rich = (text: string) => [{
  plain_text: text,
  href: null,
  annotations: {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    color: "default",
  },
}];

describe("manual block renderer", () => {
  it("renders converted Notion headings and body while keeping unsupported content visible", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const blocks = [
      blockFromNotion({ id: "safety", type: "heading_1", heading_1: { rich_text: rich("安全管理") } }),
      blockFromNotion({ id: "body", type: "paragraph", paragraph: { rich_text: rich("入水前に人数を確認") } }),
      blockFromNotion({ id: "unknown", type: "breadcrumb", breadcrumb: {} }),
    ];
    const html = renderToStaticMarkup(<ManualBlocks blocks={blocks} pageTitle="スタッフガイド" />);
    expect(html).toContain('id="block-safety"');
    expect(html).toContain("安全管理");
    expect(html).toContain("入水前に人数を確認");
    expect(html).toContain("この形式の内容はアプリ内で表示できません");
  });
});
