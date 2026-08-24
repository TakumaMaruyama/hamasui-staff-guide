import Link from "next/link";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { SearchForm } from "@/src/components/search-form";
import { SyncButton } from "@/src/components/sync-button";
import { iconForCategory, siteConfig } from "@/src/config/site";
import {
  categoriesFromSnapshot,
  formatDate,
  recentPages,
} from "@/src/lib/manuals/presentation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadManualSnapshot();
  if (!result.ok) {
    return (
      <div className="page-container page-container--state">
        <ManualUnavailable />
      </div>
    );
  }

  const { snapshot, source, warning } = result.data;
  const categories = categoriesFromSnapshot(snapshot);
  const safety = categories.find((category) => category.isSafety);
  const updates = recentPages(snapshot);
  const root = snapshot.pages.find((page) => page.id === snapshot.rootPageId);

  return (
    <>
      {source === "stale" || warning === "stale-fallback" ? (
        <StaleWarning syncedAt={snapshot.syncedAt} />
      ) : null}

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__inner">
          <p className="eyebrow">{siteConfig.organization}</p>
          <h1 id="home-title">{siteConfig.concept}</h1>
          <p>{siteConfig.description}</p>
          <span className="home-hero__label">指導・安全・運営の基準を、必要なときにすぐ確認できます。</span>
        </div>
      </section>

      <div className="page-container home-content">
        <SearchForm />

        <Link
          className="safety-quick-link"
          href={safety?.href ?? "/search?q=%E5%AE%89%E5%85%A8"}
        >
          <span className="safety-quick-link__icon" aria-hidden="true">!</span>
          <span>
            <strong>安全・緊急対応</strong>
            <small>事故や急変時の判断基準を最優先で確認する</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>

        <section className="home-section" aria-labelledby="categories-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">マニュアル</p>
              <h2 id="categories-title">目的から探す</h2>
            </div>
            <Link href="/manuals">すべて見る →</Link>
          </div>

          {categories.length > 0 ? (
            <div className="category-grid">
              {categories.map((category) => (
                <Link
                  className={category.isSafety ? "category-card category-card--safety" : "category-card"}
                  href={category.href}
                  key={category.id}
                >
                  <span className="category-card__icon" aria-hidden="true">
                    {iconForCategory(category.title)}
                  </span>
                  <span className="category-card__body">
                    <strong>{category.title}</strong>
                    <small>{category.description}</small>
                    <span>{category.pageCount}ページ</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">Notionの見出しまたは子ページがここに表示されます。</p>
          )}
        </section>

        <section className="home-section" aria-labelledby="recent-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">最新情報</p>
              <h2 id="recent-title">最近更新されたページ</h2>
            </div>
          </div>
          {updates.length > 0 ? (
            <ol className="recent-list">
              {updates.map((page) => (
                <li key={page.id}>
                  <Link href={`/manual/${encodeURIComponent(page.slug)}`}>
                    <span>
                      <strong>{page.title}</strong>
                      <small>{page.breadcrumbs.at(-1)?.title ?? root?.title ?? "マニュアル"}</small>
                    </span>
                    <time dateTime={page.lastEditedTime}>{formatDate(page.lastEditedTime)}</time>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">更新日は取得できませんでした。</p>
          )}
        </section>

        <section className="all-manuals-panel" aria-labelledby="all-manuals-title">
          <div>
            <p className="eyebrow">全{snapshot.pages.length}ページ</p>
            <h2 id="all-manuals-title">すべてのマニュアル</h2>
            <p>階層順の一覧から探せます。</p>
          </div>
          <Link href="/manuals">一覧を開く →</Link>
        </section>

        <footer className="sync-footer">
          <div>
            <small>最終同期</small>
            <strong>{formatDate(snapshot.syncedAt, true) ?? "取得できません"}</strong>
          </div>
          <SyncButton />
        </footer>
      </div>
    </>
  );
}
