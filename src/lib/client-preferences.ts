/**
 * Per-device manual preferences. These values are intentionally kept outside
 * the Notion snapshot: staff manual content remains read-only and canonical
 * in Notion.
 */
export const MANUAL_PREFERENCES_STORAGE_KEY = "hamasui-manual-preferences:v1";
export const MAX_FAVORITE_MANUALS = 8;
export const MAX_RECENT_MANUALS = 8;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type ManualPageSummary = {
  id: string;
  title: string;
  slug: string;
};

export type ManualPreferences = {
  favoritePageIds: string[];
  recentPages: ManualPageSummary[];
};

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function isPageSummary(value: unknown): value is ManualPageSummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["id", "title", "slug"].every(
    (key) => typeof candidate[key] === "string" && candidate[key].length > 0,
  );
}

export function emptyManualPreferences(): ManualPreferences {
  return { favoritePageIds: [], recentPages: [] };
}

export function normalizeManualPreferences(value: unknown): ManualPreferences {
  if (!value || typeof value !== "object") return emptyManualPreferences();
  const candidate = value as Record<string, unknown>;
  const recentPages = Array.isArray(candidate.recentPages)
    ? candidate.recentPages.filter(isPageSummary)
    : [];

  return {
    favoritePageIds: uniqueStrings(candidate.favoritePageIds).slice(0, MAX_FAVORITE_MANUALS),
    recentPages: recentPages
      .filter((page, index, pages) => pages.findIndex((item) => item.id === page.id) === index)
      .slice(0, MAX_RECENT_MANUALS),
  };
}

export function readManualPreferences(storage?: StorageLike | null): ManualPreferences {
  if (!storage) return emptyManualPreferences();
  try {
    const raw = storage.getItem(MANUAL_PREFERENCES_STORAGE_KEY);
    return raw ? normalizeManualPreferences(JSON.parse(raw)) : emptyManualPreferences();
  } catch {
    // Privacy settings, quota errors, or malformed legacy values must never
    // block the manual itself from rendering.
    return emptyManualPreferences();
  }
}

export function writeManualPreferences(storage: StorageLike | null | undefined, value: ManualPreferences): void {
  if (!storage) return;
  try {
    storage.setItem(MANUAL_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizeManualPreferences(value)));
  } catch {
    // The feature is optional; fail open when local storage is unavailable.
  }
}

export function toggleFavoritePage(preferences: ManualPreferences, pageId: string): ManualPreferences {
  if (!pageId) return preferences;
  const favoritePageIds = preferences.favoritePageIds.includes(pageId)
    ? preferences.favoritePageIds.filter((id) => id !== pageId)
    : [pageId, ...preferences.favoritePageIds].slice(0, MAX_FAVORITE_MANUALS);
  return { ...preferences, favoritePageIds };
}

export function recordRecentPage(
  preferences: ManualPreferences,
  page: ManualPageSummary,
): ManualPreferences {
  if (!isPageSummary(page)) return preferences;
  return {
    ...preferences,
    recentPages: [page, ...preferences.recentPages.filter((item) => item.id !== page.id)]
      .slice(0, MAX_RECENT_MANUALS),
  };
}

export function clearRecentPages(preferences: ManualPreferences): ManualPreferences {
  return { ...preferences, recentPages: [] };
}

/** Filters old device data against the current read-only snapshot. */
export function pagesInPreferenceOrder(
  storedPages: ManualPageSummary[],
  availablePages: ManualPageSummary[],
): ManualPageSummary[] {
  const availableById = new Map(availablePages.map((page) => [page.id, page]));
  return storedPages.flatMap((storedPage) => {
    const current = availableById.get(storedPage.id);
    return current ? [current] : [];
  });
}
