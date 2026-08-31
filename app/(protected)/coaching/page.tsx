import Link from "next/link";
import type { Metadata } from "next";
import { ImageLightbox } from "@/src/components/image-lightbox";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import {
  coachingCourseKeyFromParam,
  coachingCourses,
  type CoachingCourse,
} from "@/src/lib/manuals/field-navigation";
import { loadManualSnapshot } from "@/src/lib/manuals/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "指導を探す" };

const OVERVIEW_IMAGES = [
  {
    src: "/images/coaching/coaching-philosophy.jpg",
    alt: "泳ぎの技術だけでなく、できた体験や非認知能力を育てる指導の考え方",
    caption: "はまスイの指導哲学",
    width: 1280,
    height: 714,
  },
  {
    src: "/images/coaching/course-map.jpg",
    alt: "初級からチャレンジまでの目標、練習内容、昇級基準をまとめた全体図",
    caption: "はまスイ指導マップ",
    width: 1280,
    height: 960,
  },
] as const;

const COURSE_POSTERS = {
  "初級": {
    src: "/images/coaching/beginner-course.jpg",
    alt: "水に慣れ、自分で呼吸しながら泳ぐ土台づくりの目標と指導ポイント",
    caption: "初級コース",
    width: 1024,
    height: 1280,
  },
  "中級": {
    src: "/images/coaching/intermediate-course.jpg",
    alt: "呼吸しながらクロールで長く泳ぐ力を育てる目標と指導ポイント",
    caption: "中級コース",
    width: 1024,
    height: 1280,
  },
  "上級": {
    src: "/images/coaching/advanced-course.jpg",
    alt: "四泳法の型を身につけ、競泳の練習へつなげる目標と指導ポイント",
    caption: "上級コース",
    width: 1024,
    height: 1280,
  },
  "チャレンジ": {
    src: "/images/coaching/challenge-course.jpg",
    alt: "人としても競泳選手としても輝くための目標と指導ポイント",
    caption: "チャレンジコース",
    width: 960,
    height: 1280,
  },
} as const;

type CoachingPageProps = {
  searchParams: Promise<{ course?: string | string[] }>;
};

export default async function CoachingPage({ searchParams }: CoachingPageProps) {
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
  const params = await searchParams;
  const selectedKey = coachingCourseKeyFromParam(params.course);
  const selectedCourse = courses.find((course) => course.key === selectedKey);

  return (
    <>
      {source === "stale" || warning === "stale-fallback" ? (
        <StaleWarning syncedAt={snapshot.syncedAt} />
      ) : null}
      <div className="page-container standard-page coaching-page">
        <header className="standard-page__header">
          <p className="eyebrow">水泳指導</p>
          <h1>指導を探す</h1>
          <p>{selectedCourse
            ? `${selectedCourse.title}コースの種目から、確認したい指導を選んでください。`
            : "担当するコースを選ぶと、必要な種目だけを確認できます。"}</p>
        </header>

        <details className="coaching-reference">
          <summary>指導の全体像を見る</summary>
          <div className="coaching-overview__images">
            {OVERVIEW_IMAGES.map((image) => (
              <ImageLightbox key={image.src} {...image} />
            ))}
          </div>
        </details>

        <nav className="coaching-course-nav" aria-label="コースを選ぶ">
          {courses.map((course) => (
            <Link
              href={{ pathname: "/coaching", query: { course: course.key } }}
              key={course.key}
              aria-current={course.key === selectedCourse?.key ? "page" : undefined}
            >
              <strong>{course.title}</strong>
              <small>{course.pages.length > 0 ? `${course.pages.length}種目` : "種目を確認"}</small>
            </Link>
          ))}
        </nav>

        {selectedCourse ? (
          <SelectedCourse course={selectedCourse} />
        ) : (
          <section className="coaching-prompt" aria-labelledby="coaching-prompt-title">
            <p className="eyebrow">STEP 1</p>
            <h2 id="coaching-prompt-title">担当コースを選んでください</h2>
            <p>選択すると、そのコースの種目だけを表示します。</p>
          </section>
        )}

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

function SelectedCourse({ course }: { course: CoachingCourse }) {
  return (
    <section
      className="coaching-course coaching-course--selected"
      aria-labelledby="selected-course-title"
    >
      <header className="coaching-course__header">
        <div>
          <p>選択中のコース</p>
          <h2 id="selected-course-title">{course.title}</h2>
        </div>
        {course.page ? (
          <Link href={`/manual/${encodeURIComponent(course.page.slug)}`}>
            コース概要
          </Link>
        ) : null}
      </header>

      <div className="coaching-course__poster">
        <ImageLightbox {...COURSE_POSTERS[course.title]} />
      </div>

      <div className="coaching-step-heading">
        <p className="eyebrow">STEP 2</p>
        <h3>確認する種目を選ぶ</h3>
      </div>

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
  );
}
