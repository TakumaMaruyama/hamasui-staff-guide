export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "はまスイ Staff Guide",
  organization: "はまだスイミングスクール",
  concept: "夢中と挑戦を、未来へ。",
  description:
    "すべての人に、夢中になれる水の世界と挑戦の場を。泳ぎを通した自己実現へつなげます。",
  safetyKeywords: ["安全", "緊急", "救命", "事故"],
  categoryIcons: {
    安全: "!",
    緊急: "!",
    指導: "水",
    初級: "1",
    中級: "2",
    上級: "3",
    新人: "新",
    送迎: "車",
  } satisfies Record<string, string>,
} as const;

export function iconForCategory(title: string): string {
  const match = Object.entries(siteConfig.categoryIcons).find(([keyword]) =>
    title.includes(keyword),
  );
  return match?.[1] ?? "水";
}

export function isSafetyTitle(title: string): boolean {
  return siteConfig.safetyKeywords.some((keyword) => title.includes(keyword));
}
