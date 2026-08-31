"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "ホーム", match: "home" },
  { href: "/coaching", label: "指導", match: "coaching" },
  { href: "/search", label: "検索", match: "search" },
  { href: "/emergency", label: "安全", match: "emergency" },
  { href: "/manuals", label: "一覧", match: "manuals" },
] as const;

export function MobileNavigation() {
  const pathname = usePathname();
  return <NavigationItems pathname={pathname} />;
}

export function MobileNavigationFallback() {
  return <NavigationItems pathname="" />;
}

function NavigationItems({ pathname }: { pathname: string }) {
  return (
    <nav className="mobile-nav" aria-label="モバイルナビゲーション">
      {items.map((item) => {
        const isCurrent =
          (item.match === "home" && pathname === "/")
          || (item.match === "search" && pathname === "/search")
          || (item.match === "coaching" && pathname === "/coaching")
          || (item.match === "emergency" && pathname === "/emergency")
          || (item.match === "manuals" && (pathname === "/manuals" || pathname.startsWith("/manual/")));
        return (
          <Link
            href={item.href}
            key={item.href}
            aria-current={isCurrent ? "page" : undefined}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
