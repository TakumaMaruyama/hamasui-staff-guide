import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManualBlocks } from "../src/components/manual-blocks";
import { ImageLightbox } from "../src/components/image-lightbox";
import { blockFromNotion } from "../src/lib/notion/transform";
import type { ManualBlock } from "../src/types/manual";

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

  it("renders a resolved page shortcut as an encoded manual link", () => {
    const shortcut: ManualBlock = {
      id: "shortcut",
      children: [],
      type: "link_to_page",
      targetType: "page_id",
      targetId: "advanced",
      title: "上級コース",
      slug: "上級コース",
    };

    const html = renderToStaticMarkup(<ManualBlocks blocks={[shortcut]} pageTitle="スタッフガイド" />);

    expect(html).toContain('/manual/%E4%B8%8A%E7%B4%9A%E3%82%B3%E3%83%BC%E3%82%B9');
    expect(html).toContain("上級コース");
    expect(html).not.toContain("この形式の内容はアプリ内で表示できません");
  });

  it("keeps an unresolved shortcut visible without creating a broken link", () => {
    const shortcut: ManualBlock = {
      id: "missing-shortcut",
      children: [],
      type: "link_to_page",
      targetType: "page_id",
      targetId: "missing",
    };

    const html = renderToStaticMarkup(<ManualBlocks blocks={[shortcut]} pageTitle="スタッフガイド" />);

    expect(html).toContain("このリンク先はアプリ内で表示できません");
    expect(html).not.toContain("href=");
  });

  it("mounts only the thumbnail image until the lightbox is opened", () => {
    const image: ManualBlock = {
      id: "pool-layout",
      children: [],
      type: "image",
      media: { url: "https://example.com/pool.jpg", caption: [] },
    };

    const html = renderToStaticMarkup(<ManualBlocks blocks={[image]} pageTitle="プール配置" />);

    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).not.toContain("<dialog");
  });

  it("preserves intrinsic dimensions for local reference images", () => {
    const html = renderToStaticMarkup(
      <ImageLightbox
        src="/images/coaching/beginner-course.jpg"
        alt="初級コースの指導資料"
        width={1024}
        height={1280}
      />,
    );

    expect(html).toContain('src="/images/coaching/beginner-course.jpg"');
    expect(html).toContain('width="1024"');
    expect(html).toContain('height="1280"');
  });

  it("announces that external manual links open in a new tab", () => {
    const bookmark: ManualBlock = {
      id: "reference",
      children: [],
      type: "bookmark",
      url: "https://example.com/reference",
      caption: [],
    };

    const html = renderToStaticMarkup(<ManualBlocks blocks={[bookmark]} pageTitle="スタッフガイド" />);

    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("新しいタブで開きます");
  });
});
