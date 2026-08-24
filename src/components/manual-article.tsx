import Link from "next/link";
import { blockAnchorId, formatDate } from "@/src/lib/manuals/presentation";
import type { ManualPage } from "@/src/types/manual";
import { ManualBlocks } from "./manual-blocks";
import { SyncButton } from "./sync-button";

type ManualArticleProps = {
  page: ManualPage;
  previous?: ManualPage;
  next?: ManualPage;
};

export function ManualArticle({ page, previous, next }: ManualArticleProps) {
  const updatedAt = formatDate(page.lastEditedTime, true);
  return (
    <div className="manual-page">
      <nav className="breadcrumbs" aria-label="パンくずリスト">
        <ol>
          <li><Link href="/">ホーム</Link></li>
          {page.breadcrumbs.map((crumb) => (
            <li key={crumb.id}>
              <span aria-hidden="true">/</span>
              <Link href={`/manual/${encodeURIComponent(crumb.slug)}`}>{crumb.title}</Link>
            </li>
          ))}
          <li aria-current="page"><span aria-hidden="true">/</span>{page.title}</li>
        </ol>
      </nav>

      <header className="manual-page__header">
        <p className="eyebrow">マニュアル</p>
        <h1>{page.title}</h1>
        <div className="manual-page__meta">
          {updatedAt ? <span>最終更新: {updatedAt}</span> : <span>更新日は取得できません</span>}
          <SyncButton />
        </div>
      </header>

      {page.headings.length > 0 ? (
        <details className="mobile-toc">
          <summary>このページの目次</summary>
          <TableOfContents page={page} />
        </details>
      ) : null}

      <div className="manual-layout">
        <article className="manual-body">
          <ManualBlocks blocks={page.blocks} pageTitle={page.title} />
        </article>

        {page.headings.length > 0 ? (
          <aside className="desktop-toc" aria-label="このページの目次">
            <p>このページ</p>
            <TableOfContents page={page} />
          </aside>
        ) : null}
      </div>

      <nav className="page-navigation" aria-label="前後のマニュアル">
        {previous ? (
          <Link href={`/manual/${encodeURIComponent(previous.slug)}`}>
            <small>← 前のページ</small><strong>{previous.title}</strong>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/manual/${encodeURIComponent(next.slug)}`}>
            <small>次のページ →</small><strong>{next.title}</strong>
          </Link>
        ) : null}
      </nav>

      <a className="back-to-top" href="#top">ページ上部へ戻る</a>
    </div>
  );
}

function TableOfContents({ page }: { page: ManualPage }) {
  return (
    <ol className="toc-list">
      {page.headings.map((heading) => (
        <li key={heading.id} data-level={heading.level}>
          <a href={`#${blockAnchorId(heading.id)}`}>{heading.text}</a>
        </li>
      ))}
    </ol>
  );
}
