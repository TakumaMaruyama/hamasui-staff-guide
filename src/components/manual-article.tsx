import Link from "next/link";
import { blockAnchorId, formatDate } from "@/src/lib/manuals/presentation";
import { isRoutineChecklistPage } from "@/src/lib/routine-checklist";
import type { ManualPage } from "@/src/types/manual";
import {
  ManualFavoriteButton,
  ManualRecentTracker,
} from "./manual-preferences";
import { ManualBlocks } from "./manual-blocks";
import { RoutineChecklist } from "./routine-checklist";
import { SyncButton } from "./sync-button";

type ManualArticleProps = {
  page: ManualPage;
  previous?: ManualPage;
  next?: ManualPage;
  quickLinks?: Array<{ label: string; href?: string }>;
  tone?: "standard" | "emergency";
};

export function ManualArticle({ page, previous, next, quickLinks, tone = "standard" }: ManualArticleProps) {
  const updatedAt = formatDate(page.lastEditedTime, true);
  const pageSummary = { id: page.id, title: page.title, slug: page.slug };
  const sectionLinks = quickLinks ?? coachingSectionLinks(page);
  return (
    <div className={`manual-page manual-page--${tone}`}>
      <ManualRecentTracker page={pageSummary} />
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
          <div className="manual-page__actions">
            <ManualFavoriteButton page={pageSummary} />
          </div>
        </div>
      </header>

      {sectionLinks.length > 0 ? (
        <nav className="manual-quick-links" aria-label="このページの重要項目">
          {sectionLinks.map((link) => (
            link.href ? (
              <a href={link.href} key={`${link.label}-${link.href}`}>{link.label}</a>
            ) : (
              <span aria-disabled="true" key={link.label}>{link.label}</span>
            )
          ))}
        </nav>
      ) : null}

      {page.headings.length > 0 ? (
        <details className="mobile-toc">
          <summary>このページの目次</summary>
          <TableOfContents page={page} />
        </details>
      ) : null}

      <div className="manual-layout">
        <article className="manual-body">
          {isRoutineChecklistPage(page.title) ? (
            <RoutineChecklist pageId={page.id} pageTitle={page.title} blocks={page.blocks} />
          ) : null}
          <ManualBlocks blocks={page.blocks} pageTitle={page.title} />
        </article>

        {page.headings.length > 0 ? (
          <aside className="desktop-toc" aria-label="このページの目次">
            <p>このページ</p>
            <TableOfContents page={page} />
          </aside>
        ) : null}
      </div>

      {previous || next ? (
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
      ) : null}

      <div className="manual-footer-actions">
        <SyncButton />
      </div>

      <a className="back-to-top" href="#top">ページ上部へ戻る</a>
    </div>
  );
}

const COACHING_SECTION_LABELS = ["目標", "指導のポイント", "安全の注意"] as const;

function coachingSectionLinks(page: ManualPage): Array<{ label: string; href?: string }> {
  const links = COACHING_SECTION_LABELS.flatMap((label) => {
    const heading = page.headings.find((item) => item.text.includes(label));
    return heading ? [{ label, href: `#${blockAnchorId(heading.id)}` }] : [];
  });
  return links.length >= 2 ? links : [];
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
