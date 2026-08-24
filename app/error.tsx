"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-container page-container--state">
      <div className="state-panel" role="alert">
        <span aria-hidden="true">!</span>
        <div>
          <h1>画面を表示できませんでした。</h1>
          <p>時間を置いて、もう一度お試しください。</p>
          <button type="button" onClick={reset}>もう一度試す</button>
        </div>
      </div>
    </main>
  );
}
