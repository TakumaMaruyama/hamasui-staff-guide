import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { blockAnchorId } from "@/src/lib/manuals/presentation";
import type {
  ManualBlock,
  ManualTableBlock,
  ManualTableRowBlock,
} from "@/src/types/manual";
import { ImageLightbox } from "./image-lightbox";
import { ManualRichText, richTextPlain } from "./manual-rich-text";

type ManualBlocksProps = {
  blocks: ManualBlock[];
  pageTitle: string;
};

function safeMediaUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

function BlockChildren({ block, pageTitle }: { block: ManualBlock; pageTitle: string }) {
  if (block.children.length === 0) return null;
  return <ManualBlocks blocks={block.children} pageTitle={pageTitle} />;
}

function TableBlock({ block }: { block: ManualTableBlock }) {
  const rows = block.children.filter(
    (child): child is ManualTableRowBlock => child.type === "table_row",
  );
  if (rows.length === 0) return null;
  return (
    // 横長の表をキーボードでスクロールできるようフォーカス可能にする。
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="manual-table" role="region" aria-label="表。左右にスクロールできます。" tabIndex={0}>
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {row.cells.map((cell, cellIndex) => {
                const isHeader =
                  (block.hasColumnHeader && rowIndex === 0) ||
                  (block.hasRowHeader && cellIndex === 0);
                const Cell = isHeader ? "th" : "td";
                return (
                  <Cell key={`${row.id}-${cellIndex}`} scope={isHeader ? (rowIndex === 0 ? "col" : "row") : undefined}>
                    <ManualRichText value={cell} />
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SingleBlock({ block, pageTitle }: { block: ManualBlock; pageTitle: string }): ReactNode {
  const anchor = blockAnchorId(block.id);
  switch (block.type) {
    case "paragraph":
      return (
        <>
          <p className={block.richText.length === 0 ? "empty-paragraph" : undefined}>
            <ManualRichText value={block.richText} />
          </p>
          <BlockChildren block={block} pageTitle={pageTitle} />
        </>
      );
    case "heading_1":
    case "heading_2":
    case "heading_3": {
      const level = Number(block.type.slice(-1));
      const content = <ManualRichText value={block.richText} />;
      const children = <BlockChildren block={block} pageTitle={pageTitle} />;
      if (level === 1) return <section><h2 id={anchor}>{content}</h2>{children}</section>;
      if (level === 2) return <section><h3 id={anchor}>{content}</h3>{children}</section>;
      return <section><h4 id={anchor}>{content}</h4>{children}</section>;
    }
    case "toggle":
      return (
        <details className="manual-toggle">
          <summary><ManualRichText value={block.richText} /></summary>
          <BlockChildren block={block} pageTitle={pageTitle} />
        </details>
      );
    case "quote":
      return (
        <blockquote>
          <ManualRichText value={block.richText} />
          <BlockChildren block={block} pageTitle={pageTitle} />
        </blockquote>
      );
    case "to_do":
      return (
        <div className="manual-todo">
          <span aria-hidden="true">
            {block.checked ? "☑" : "☐"}
          </span>
          <span><span className="sr-only">{block.checked ? "完了: " : "未完了: "}</span><ManualRichText value={block.richText} /></span>
        </div>
      );
    case "callout":
      return (
        <aside className={`manual-callout manual-callout--${block.color ?? "default"}`}>
          <span aria-hidden="true">{block.icon ?? "i"}</span>
          <div>
            <ManualRichText value={block.richText} />
            <BlockChildren block={block} pageTitle={pageTitle} />
          </div>
        </aside>
      );
    case "divider":
      return <hr />;
    case "image": {
      const src = safeMediaUrl(block.media.url);
      const caption = richTextPlain(block.media.caption);
      return src ? (
        <ImageLightbox
          src={src}
          alt={caption || `${pageTitle}の説明画像`}
          caption={caption || undefined}
        />
      ) : (
        <div className="manual-image-fallback">画像を表示できません。</div>
      );
    }
    case "video": {
      const src = safeMediaUrl(block.media.url);
      const caption = richTextPlain(block.media.caption);
      const isDirectVideo = src
        ? /\.(mp4|webm|ogg)(?:$|[?#])/i.test(`${src} ${block.media.name ?? ""}`)
        : false;
      return src ? (
        <figure className="manual-media">
          {isDirectVideo ? (
            <>
              {/* Notion APIは字幕trackを提供しないため、画面上のcaptionを併記する。 */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls preload="metadata">
                <source src={src} />
                ご利用のブラウザでは動画を再生できません。
              </video>
            </>
          ) : (
            <a className="manual-file" href={src} target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">VIDEO</span>
              <span>{caption || "動画を開く"}<span className="sr-only">（新しいタブで開きます）</span></span>
            </a>
          )}
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      ) : (
        <div className="manual-media-fallback">動画を表示できません。</div>
      );
    }
    case "file":
    case "pdf": {
      const href = safeMediaUrl(block.media.url);
      const caption = richTextPlain(block.media.caption);
      return href ? (
        <a className="manual-file" href={href} target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">{block.type === "pdf" ? "PDF" : "FILE"}</span>
          <span>{caption || block.media.name || "ファイルを開く"}<span className="sr-only">（新しいタブで開きます）</span></span>
        </a>
      ) : (
        <div className="manual-media-fallback">ファイルを表示できません。</div>
      );
    }
    case "bookmark": {
      const href = safeMediaUrl(block.url);
      const label = richTextPlain(block.caption) || block.url || "参考リンク";
      return href ? (
        <a className="manual-bookmark" href={href} target="_blank" rel="noopener noreferrer">
          <span>{label}<span className="sr-only">（新しいタブで開きます）</span></span><span aria-hidden="true">↗</span>
        </a>
      ) : (
        <p>{label}</p>
      );
    }
    case "code":
      return (
        <figure className="manual-code">
          <pre><code><ManualRichText value={block.richText} /></code></pre>
          {block.caption.length ? <figcaption><ManualRichText value={block.caption} /></figcaption> : null}
        </figure>
      );
    case "table":
      return <TableBlock block={block} />;
    case "table_row":
      return (
        <div className="manual-table-row-fallback">
          {block.cells.map((cell, index) => <span key={`${block.id}-${index}`}><ManualRichText value={cell} /></span>)}
        </div>
      );
    case "column_list":
      return <div className="manual-columns"><BlockChildren block={block} pageTitle={pageTitle} /></div>;
    case "column":
      return <div className="manual-column"><BlockChildren block={block} pageTitle={pageTitle} /></div>;
    case "synced_block":
      return <BlockChildren block={block} pageTitle={pageTitle} />;
    case "child_page":
      return (
        <Link className="child-page-link" href={`/manual/${encodeURIComponent(block.slug)}`}>
          <span><strong>{block.title}</strong><small>関連するマニュアル</small></span>
          <span aria-hidden="true">→</span>
        </Link>
      );
    case "link_to_page":
      return block.title && block.slug ? (
        <Link className="child-page-link" href={`/manual/${encodeURIComponent(block.slug)}`}>
          <span><strong>{block.title}</strong><small>関連するマニュアル</small></span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <div className="manual-unsupported" role="note">
          このリンク先はアプリ内で表示できません。Notionで確認してください。
        </div>
      );
    case "child_database":
      return (
        <div className="manual-unsupported">
          <strong>{block.title}</strong>
          {block.children.length > 0 ? (
            <BlockChildren block={block} pageTitle={pageTitle} />
          ) : (
            <p>
              {block.isLoaded
                ? "登録されたマニュアルはありません。"
                : "この一覧はNotionで確認してください。"}
            </p>
          )}
        </div>
      );
    case "unsupported":
      return (
        <div className="manual-unsupported" role="note">
          この形式の内容はアプリ内で表示できません。Notionで確認してください。
        </div>
      );
  }
}

export function ManualBlocks({ blocks, pageTitle }: ManualBlocksProps) {
  const rendered: ReactNode[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
      const type = block.type;
      const items = [];
      while (index < blocks.length && blocks[index].type === type) {
        const item = blocks[index];
        if (item.type !== type) break;
        items.push(
          <li key={item.id}>
            <ManualRichText value={item.richText} />
            <BlockChildren block={item} pageTitle={pageTitle} />
          </li>,
        );
        index += 1;
      }
      const List = type === "bulleted_list_item" ? "ul" : "ol";
      rendered.push(<List key={`${type}-${block.id}`}>{items}</List>);
      continue;
    }

    rendered.push(<Fragment key={block.id}>{SingleBlock({ block, pageTitle })}</Fragment>);
    index += 1;
  }

  return rendered;
}
