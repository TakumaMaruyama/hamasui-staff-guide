import Link from "next/link";
import { RetryButton } from "./retry-button";

export function ManualUnavailable({ hasCache = false }: { hasCache?: boolean }) {
  return (
    <div className="state-panel" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <h1>マニュアルを取得できませんでした。</h1>
        <p>
          {hasCache
            ? "最新情報を取得できなかったため、前回取得した内容を表示しています。"
            : "時間を置いて、もう一度お試しください。"}
        </p>
        <div className="state-panel__actions">
          <RetryButton />
          <Link href="/">ホームに戻る</Link>
        </div>
      </div>
    </div>
  );
}

export function StaleWarning({ syncedAt }: { syncedAt: string }) {
  return (
    <div className="stale-warning" role="status">
      <strong>前回取得した内容を表示しています。</strong>
      <span>最新情報を取得できませんでした。最終同期: {new Date(syncedAt).toLocaleString("ja-JP")}</span>
    </div>
  );
}
