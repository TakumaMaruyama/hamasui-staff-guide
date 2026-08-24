import Link from "next/link";

const items = [
  { href: "/", icon: "■", label: "ホーム" },
  { href: "/search", icon: "⌕", label: "検索" },
  { href: "/search?q=%E5%AE%89%E5%85%A8", icon: "!", label: "安全" },
  { href: "/manuals", icon: "≡", label: "一覧" },
] as const;

export function MobileNavigation() {
  return (
    <nav className="mobile-nav" aria-label="モバイルナビゲーション">
      {items.map((item) => (
        <Link href={item.href} key={item.href}>
          <span aria-hidden="true">{item.icon}</span>
          <small>{item.label}</small>
        </Link>
      ))}
    </nav>
  );
}
