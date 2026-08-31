"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/src/config/site";

export function SiteHeader() {
  const pathname = usePathname();

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
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>ホーム</Link>
          <Link href="/coaching" aria-current={pathname === "/coaching" ? "page" : undefined}>指導を探す</Link>
          <Link href="/search" aria-current={pathname === "/search" ? "page" : undefined}>検索</Link>
          <Link href="/emergency" aria-current={pathname === "/emergency" ? "page" : undefined}>安全・緊急</Link>
          <Link
            href="/manuals"
            aria-current={pathname === "/manuals" || pathname.startsWith("/manual/") ? "page" : undefined}
          >
            すべてのマニュアル
          </Link>
        </nav>
      </div>
    </header>
  );
}
