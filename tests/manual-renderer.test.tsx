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

  it("renders child database rows as manual links", () => {
    const childPage = blockFromNotion(
      { id: "child", type: "child_page", child_page: { title: "開館作業" } },
      [],
      "開館作業",
    );
    const database = blockFromNotion(
      { id: "database", type: "child_database", child_database: { title: "A業務マニュアルDB" } },
      [childPage],
    );
    if (database.type === "child_database") database.isLoaded = true;

    const html = renderToStaticMarkup(<ManualBlocks blocks={[database]} pageTitle="スタッフガイド" />);

    expect(html).toContain("A業務マニュアルDB");
    expect(html).toContain("/manual/%E9%96%8B%E9%A4%A8%E4%BD%9C%E6%A5%AD");
    expect(html).toContain("開館作業");
    expect(html).not.toContain("この一覧はNotionで確認してください");
  });
});
