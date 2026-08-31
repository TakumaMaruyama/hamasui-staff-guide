import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ManualLoading } from "@/src/components/manual-loading";
import { ManualPreferenceLists } from "@/src/components/manual-preferences";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { SearchForm } from "@/src/components/search-form";
import { SyncButton } from "@/src/components/sync-button";
import { iconForCategory, siteConfig } from "@/src/config/site";
import {
  coachingCourses,
  fieldManualGroups,
  type FieldManualGroup,
  type FieldManualGroupKey,
} from "@/src/lib/manuals/field-navigation";
import {
  formatDate,
  recentPages,
} from "@/src/lib/manuals/presentation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ホーム",
};

async function HomeContent() {
  const result = await loadManualSnapshot();
  if (!result.ok) {
    return (
      <div className="page-container page-container--state">
        <ManualUnavailable />
      </div>
    );
  }

  const { snapshot, source, warning } = result.data;
  const groups = fieldManualGroups(snapshot);
  const { courses } = coachingCourses(snapshot);
  const updates = recentPages(snapshot);
  const root = snapshot.pages.find((page) => page.id === snapshot.rootPageId);
  const pageSummaries = snapshot.pages
    .filter((page) => page.id !== snapshot.rootPageId)
    .map(({ id, title, slug }) => ({ id, title, slug }));

  return (
    <>
      {source === "stale" || warning === "stale-fallback" ? (
        <StaleWarning syncedAt={snapshot.syncedAt} />
      ) : null}

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__inner">
          <p className="eyebrow">{siteConfig.organization}</p>
          <h1 id="home-title">{siteConfig.concept}</h1>
        </div>
      </section>

      <div className="page-container home-content">
        <section className="home-coaching-panel" aria-labelledby="home-coaching-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">コースから選ぶ</p>
              <h2 id="home-coaching-title">指導を探す</h2>
            </div>
            <Link href="/coaching">選び方を見る</Link>
          </div>

          <div className="home-course-grid">
            {courses.map((course) => (
              <Link
                href={{ pathname: "/coaching", query: { course: course.key } }}
                key={course.key}
              >
                <strong>{course.title}</strong>
                <small>{course.pages.length > 0 ? `${course.pages.length}種目` : "種目を確認"}</small>
              </Link>
            ))}
          </div>
        </section>

        <Link className="safety-quick-link" href="/emergency">
          <span className="safety-quick-link__icon" aria-hidden="true">!</span>
          <span>
            <strong>安全・緊急対応</strong>
            <small>事故や急変時の対応を確認する</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>

        <div className="home-search"><SearchForm /></div>

        <ManualPreferenceLists pages={pageSummaries} />

        <section className="field-command-panel" aria-labelledby="field-command-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">業務場面から選ぶ</p>
              <h2 id="field-command-title">指導以外の業務</h2>
            </div>
          </div>

          <div className="field-action-grid">
            {OPERATION_FIELD_LINKS.map((item) => {
              const group = groups.find((candidate) => candidate.key === item.key);
              return (
                <Link className="field-action-card" href={item.href} key={item.key}>
                  <span className="field-action-card__icon" aria-hidden="true">
                    {iconForCategory(group?.title ?? item.label)}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{group?.pages.length ?? 0}件</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        </section>

        {OPERATION_FIELD_LINKS.map((item) => (
          <FieldManualSection
            group={groups.find((candidate) => candidate.key === item.key)}
            id={`field-${item.key}`}
            key={item.key}
            title={item.label}
          />
        ))}

        <SecondaryManualSection groups={groups} />

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

const OPERATION_FIELD_LINKS: Array<{
  key: Extract<FieldManualGroupKey, "before" | "after" | "guardian">;
  label: string;
  href: string;
}> = [
  { key: "before", label: "指導前", href: "#field-before" },
  { key: "after", label: "指導後", href: "#field-after" },
  { key: "guardian", label: "保護者対応", href: "#field-guardian" },
];

function FieldManualSection({ group, id, title }: { group?: FieldManualGroup; id: string; title: string }) {
  if (!group || group.pages.length === 0) return null;
  return (
    <section className="home-section field-manual-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{group.title}</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </div>
      <div className="field-page-grid">
        {group.pages.map((page) => (
          <Link href={`/manual/${encodeURIComponent(page.slug)}`} key={page.id}>
            <strong>{page.title}</strong>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SecondaryManualSection({ groups }: { groups: FieldManualGroup[] }) {
  const secondaryGroups = groups.filter(
    (group) => (group.key === "intro" || group.key === "other") && group.pages.length > 0,
  );
  if (secondaryGroups.length === 0) return null;
  return (
    <section className="home-section secondary-manuals" aria-labelledby="secondary-manuals-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">はじめに・その他</p>
          <h2 id="secondary-manuals-title">その他のマニュアル</h2>
        </div>
      </div>
      <div className="secondary-manuals__groups">
        {secondaryGroups.map((group, index) => (
          <div className="secondary-manual-group" key={`${group.key}-${group.sourceTitle ?? group.title}-${index}`}>
            <h3>{group.key === "intro" ? group.title : (group.sourceTitle ?? group.title)}</h3>
            <div className="secondary-manuals__links">
              {group.pages.map((page) => (
                <Link href={`/manual/${encodeURIComponent(page.slug)}`} key={page.id}>{page.title}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<ManualLoading variant="home" />}>
      <HomeContent />
    </Suspense>
  );
}
