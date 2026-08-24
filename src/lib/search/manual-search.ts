import type { ManualPage, ManualSnapshot } from "@/src/types/manual";

export type SearchExcerptPart = { text: string; highlighted: boolean };
export type ManualSearchResult = {
  page: ManualPage;
  score: number;
  matchedIn: "title" | "heading" | "multiple" | "body";
  excerpt: string;
  excerptParts: SearchExcerptPart[];
};

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/g, " ").trim();
}

function queryTerms(query: string): string[] {
  return [...new Set(normalizeSearchText(query).split(" ").filter(Boolean))];
}

function includesAll(value: string, terms: string[]): boolean {
  const normalized = normalizeSearchText(value);
  return terms.every((term) => normalized.includes(term));
}

type NormalizedCharacter = { start: number; end: number };

function normalizedCharacters(value: string): { value: string; map: NormalizedCharacter[] } {
  let normalized = "";
  const map: NormalizedCharacter[] = [];
  let offset = 0;
  for (const character of value) {
    const start = offset;
    offset += character.length;
    const converted = character.normalize("NFKC").toLocaleLowerCase("ja-JP");
    normalized += converted;
    for (let index = 0; index < converted.length; index += 1) {
      map.push({ start, end: offset });
    }
  }
  return { value: normalized, map };
}

export function highlightSearchText(value: string, terms: string[]): SearchExcerptPart[] {
  const normalized = normalizedCharacters(value);
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    while (from < normalized.value.length) {
      const index = normalized.value.indexOf(term, from);
      if (index < 0) break;
      const first = normalized.map[index];
      const last = normalized.map[index + term.length - 1];
      if (first && last) ranges.push([first.start, last.end]);
      from = index + Math.max(term.length, 1);
    }
  }
  const merged = ranges.sort((a, b) => a[0] - b[0]).reduce<Array<[number, number]>>((all, range) => {
    const last = all.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else all.push(range);
    return all;
  }, []);
  if (!merged.length) return [{ text: value, highlighted: false }];
  const parts: SearchExcerptPart[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: value.slice(cursor, start), highlighted: false });
    parts.push({ text: value.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), highlighted: false });
  return parts;
}

function excerptFor(text: string, terms: string[]): string {
  const normalized = normalizedCharacters(text);
  const normalizedIndex = terms
    .map((term) => normalized.value.indexOf(term))
    .find((index) => index >= 0) ?? 0;
  const originalIndex = normalized.map[normalizedIndex]?.start ?? 0;
  const start = Math.max(0, originalIndex - 36);
  const end = Math.min(text.length, originalIndex + 120);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** Japanese partial-match search. All terms must be present; title then heading then body wins. */
export function searchManual(snapshot: ManualSnapshot, query: string, limit = 30): ManualSearchResult[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  return snapshot.pages
    .flatMap((page) => {
      const title = `${page.title} ${page.breadcrumbs.map((crumb) => crumb.title).join(" ")}`;
      const headings = page.headings.map((heading) => heading.text).join(" ");
      const body = page.plainText;
      const inTitle = includesAll(title, terms);
      const inHeadings = includesAll(headings, terms);
      const inBody = includesAll(body, terms);
      const inCombined = includesAll(`${title}\n${headings}\n${body}`, terms);
      if (!inCombined) return [];
      const matchedIn: ManualSearchResult["matchedIn"] = inTitle
        ? "title"
        : inHeadings
          ? "heading"
          : inBody
            ? "body"
            : "multiple";
      const source = matchedIn === "title"
        ? title
        : matchedIn === "heading"
          ? headings
          : matchedIn === "body"
            ? body
            : `${title}\n${headings}\n${body}`;
      const excerpt = excerptFor(source, terms);
      return [{
        page,
        score: inTitle ? 300 : inHeadings ? 200 : matchedIn === "multiple" ? 150 : 100,
        matchedIn,
        excerpt,
        excerptParts: highlightSearchText(excerpt, terms),
      }];
    })
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title, "ja-JP"))
    .slice(0, limit);
}
