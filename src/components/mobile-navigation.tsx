"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const items = [
  { href: "/", icon: "■", label: "ホーム", match: "home" },
  { href: "/search", icon: "⌕", label: "検索", match: "search" },
  {
    href: "/search?q=%E5%AE%89%E5%85%A8",
    icon: "!",
    label: "安全",
    accessibleLabel: "安全・緊急対応を検索",
    match: "shortcut",
  },
  { href: "/manuals", icon: "≡", label: "一覧", match: "manuals" },
] as const;

export function MobileNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSafetySearch = pathname === "/search" && searchParams.get("q") === "安全";

  return <NavigationItems pathname={pathname} isSafetySearch={isSafetySearch} />;
}

export function MobileNavigationFallback() {
  return <NavigationItems pathname="" isSafetySearch={false} />;
}

function NavigationItems({ pathname, isSafetySearch }: { pathname: string; isSafetySearch: boolean }) {
  return (
    <nav className="mobile-nav" aria-label="モバイルナビゲーション">
      {items.map((item) => {
        const isCurrent =
          (item.match === "home" && pathname === "/")
          || (item.match === "search" && pathname === "/search" && !isSafetySearch)
          || (item.match === "shortcut" && isSafetySearch)
          || (item.match === "manuals" && (pathname === "/manuals" || pathname.startsWith("/manual/")));
        return (
          <Link
            href={item.href}
            key={item.href}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={"accessibleLabel" in item ? item.accessibleLabel : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
