import Link from "next/link";
import type { Metadata } from "next";
import { ManualUnavailable, StaleWarning } from "@/src/components/manual-state";
import { SearchForm } from "@/src/components/search-form";
import { loadManualSnapshot } from "@/src/lib/manuals/server";
import { searchManual } from "@/src/lib/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "マニュアル検索",
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").slice(0, 120);
  const loaded = await loadManualSnapshot();
  if (!loaded.ok) return <div className="page-container page-container--state"><ManualUnavailable /></div>;
  const { snapshot, source } = loaded.data;
  const results = query.trim() ? searchManual(snapshot, query) : [];

  return (
    <div className="page-container standard-page search-page">
      {source === "stale" ? <StaleWarning syncedAt={snapshot.syncedAt} /> : null}
      <header className="standard-page__header">
        <p className="eyebrow">キーワード検索</p>
        <h1>マニュアルを探す</h1>
        <p>ページ名、見出し、本文、画像キャプションから部分一致で探します。</p>
      </header>
      <SearchForm defaultValue={query} />

      {query.trim() ? (
        <section className="search-results" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">「{query}」の検索結果</p>
              <h2 id="results-title">{results.length}件見つかりました</h2>
            </div>
          </div>
          {results.length > 0 ? (
            <ol>
              {results.map((result) => (
                <li key={result.page.id}>
                  <Link href={`/manual/${encodeURIComponent(result.page.slug)}${result.targetAnchorId ? `#${result.targetAnchorId}` : ""}`}>
                    <span className="search-result__meta">
                      {result.page.breadcrumbs.map((crumb) => crumb.title).join(" / ") || "マニュアル"}
                    </span>
                    <strong>{result.page.title}</strong>
                    <p>
                      {result.excerptParts.map((part, index) =>
                        part.highlighted ? <mark key={index}>{part.text}</mark> : part.text,
                      )}
                    </p>
                    <small>
                      {result.matchedIn === "title"
                        ? "タイトルに一致"
                        : result.matchedIn === "heading"
                          ? "見出しに一致"
                          : result.matchedIn === "multiple"
                            ? "複数箇所に一致"
                            : "本文に一致"}
                    </small>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state empty-state--large">
              <strong>該当するマニュアルは見つかりませんでした。</strong>
              <p>言葉を短くするか、別のキーワードでお試しください。</p>
            </div>
          )}
        </section>
      ) : (
        <div className="search-suggestions">
          <p>例えば、次のような言葉で探せます。</p>
          <div>
            {["安全", "緊急時対応", "初級", "進級基準"].map((term) => (
              <Link key={term} href={`/search?q=${encodeURIComponent(term)}`}>{term}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
