import Link from "next/link";
import type { Metadata } from "next";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { coachingCourses } from "@/src/lib/manuals/field-navigation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "指導を探す" };

export default async function CoachingPage() {
  const result = await loadManualSnapshot();
  if (!result.ok) {
    return (
      <div className="page-container page-container--state">
        <ManualUnavailable />
      </div>
    );
  }

  const { snapshot, source, warning } = result.data;
  const { courses, hints } = coachingCourses(snapshot);

  return (
    <>
      {source === "stale" || warning === "stale-fallback" ? (
        <StaleWarning syncedAt={snapshot.syncedAt} />
      ) : null}
      <div className="page-container standard-page coaching-page">
        <header className="standard-page__header">
          <p className="eyebrow">水泳指導</p>
          <h1>指導を探す</h1>
          <p>コースから選び、目的の種目をすぐ確認できます。</p>
        </header>

        <nav className="coaching-course-nav" aria-label="コースを選ぶ">
          {courses.map((course, index) => (
            <a href={`#course-${index}`} key={course.title}>
              {course.title}
            </a>
          ))}
        </nav>

        <div className="coaching-grid">
          {courses.map((course, index) => (
            <section
              className="coaching-course"
              id={`course-${index}`}
              key={course.title}
              aria-labelledby={`course-${index}-title`}
            >
              <header className="coaching-course__header">
                <span aria-hidden="true">{course.title.slice(0, 1)}</span>
                <div>
                  <p>コース</p>
                  <h2 id={`course-${index}-title`}>{course.title}</h2>
                </div>
                {course.page ? (
                  <Link href={`/manual/${encodeURIComponent(course.page.slug)}`}>
                    概要
                  </Link>
                ) : null}
              </header>

              {course.pages.length > 0 ? (
                <div className="coaching-skill-grid">
                  {course.pages.map((page) => (
                    <Link
                      href={`/manual/${encodeURIComponent(page.slug)}`}
                      key={page.id}
                    >
                      <strong>{page.title}</strong>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="empty-state">該当するマニュアルはありません。</p>
              )}
            </section>
          ))}
        </div>

        <section className="home-section coaching-hints" aria-labelledby="coaching-hints-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">コース共通</p>
              <h2 id="coaching-hints-title">指導のヒント</h2>
            </div>
          </div>
          {hints.length > 0 ? (
            <div className="field-page-grid">
              {hints.map((page) => (
                <Link
                  href={`/manual/${encodeURIComponent(page.slug)}`}
                  key={page.id}
                >
                  <strong>{page.title}</strong>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">該当するマニュアルはありません。</p>
          )}
        </section>
      </div>
    </>
  );
}
