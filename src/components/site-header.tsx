import Link from "next/link";
import { siteConfig } from "@/src/config/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label={`${siteConfig.name} ホーム`}>
          <span className="site-brand__mark" aria-hidden="true">
            水
          </span>
          <span>
            <small>はまスイ</small>
            <strong>{siteConfig.name.replace("はまスイ ", "")}</strong>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <Link href="/">ホーム</Link>
          <Link href="/search">検索</Link>
          <Link href="/manuals">すべてのマニュアル</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit">ログアウト</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
