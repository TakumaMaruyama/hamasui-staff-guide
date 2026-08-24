import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-container page-container--state">
      <div className="state-panel">
        <span aria-hidden="true">?</span>
        <div>
          <h1>このマニュアルは見つかりませんでした。</h1>
          <p>削除または移動された可能性があります。</p>
          <Link href="/">ホームに戻る</Link>
        </div>
      </div>
    </main>
  );
}
