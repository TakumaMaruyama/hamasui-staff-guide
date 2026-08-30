"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import {
  clearRecentPages,
  emptyManualPreferences,
  MANUAL_PREFERENCES_STORAGE_KEY,
  pagesInPreferenceOrder,
  readManualPreferences,
  recordRecentPage,
  toggleFavoritePage,
  type ManualPageSummary,
  type ManualPreferences,
  type StorageLike,
  writeManualPreferences,
} from "@/src/lib/client-preferences";

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const serverPreferences = emptyManualPreferences();
let cachedPreferences: ManualPreferences | undefined;
const preferenceListeners = new Set<() => void>();

function notifyPreferenceListeners() {
  preferenceListeners.forEach((listener) => listener());
}

function currentPreferences(): ManualPreferences {
  if (typeof window === "undefined") return serverPreferences;
  if (!cachedPreferences) cachedPreferences = readManualPreferences(browserStorage());
  return cachedPreferences;
}

function subscribePreferences(listener: () => void) {
  preferenceListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== MANUAL_PREFERENCES_STORAGE_KEY) return;
    cachedPreferences = readManualPreferences(browserStorage());
    notifyPreferenceListeners();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function savePreferences(next: ManualPreferences): ManualPreferences {
  cachedPreferences = next;
  writeManualPreferences(browserStorage(), next);
  notifyPreferenceListeners();
  return next;
}

function useManualPreferences() {
  return useSyncExternalStore(subscribePreferences, currentPreferences, () => serverPreferences);
}

export function ManualFavoriteButton({ page }: { page: ManualPageSummary }) {
  const preferences = useManualPreferences();

  const isFavorite = preferences.favoritePageIds.includes(page.id);
  return (
    <button
      className="manual-favorite-button"
      type="button"
      aria-pressed={isFavorite}
      onClick={() => savePreferences(toggleFavoritePage(currentPreferences(), page.id))}
    >
      <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
      {isFavorite ? "よく使うから外す" : "よく使うに追加"}
    </button>
  );
}

/** Records a page visit without rendering any new manual content. */
export function ManualRecentTracker({ page }: { page: ManualPageSummary }) {
  const { id, slug, title } = page;
  useEffect(() => {
    savePreferences(recordRecentPage(currentPreferences(), { id, slug, title }));
  }, [id, slug, title]);
  return null;
}

export function ManualPreferenceLists({ pages }: { pages: ManualPageSummary[] }) {
  const preferences = useManualPreferences();

  const pageById = new Map(pages.map((page) => [page.id, page]));
  const favorites = preferences.favoritePageIds.flatMap((id) => {
    const page = pageById.get(id);
    return page ? [page] : [];
  });
  const recent = pagesInPreferenceOrder(preferences.recentPages, pages);
  if (favorites.length === 0 && recent.length === 0) return null;

  return (
    <section className="manual-preference-lists" aria-label="この端末のよく使うマニュアルと最近見たマニュアル">
      {favorites.length > 0 ? <PreferenceList title="よく使う" pages={favorites} /> : null}
      {recent.length > 0 ? (
        <div className="manual-preference-list">
          <div className="manual-preference-list__heading">
            <h2>最近見た</h2>
            <button
              type="button"
              onClick={() => savePreferences(clearRecentPages(currentPreferences()))}
            >
              履歴を消す
            </button>
          </div>
          <ManualPageLinks pages={recent} />
        </div>
      ) : null}
    </section>
  );
}

function PreferenceList({ title, pages }: { title: string; pages: ManualPageSummary[] }) {
  return (
    <div className="manual-preference-list">
      <h2>{title}</h2>
      <ManualPageLinks pages={pages} />
    </div>
  );
}

function ManualPageLinks({ pages }: { pages: ManualPageSummary[] }) {
  return (
    <ul>
      {pages.map((page) => (
        <li key={page.id}>
          <Link href={`/manual/${encodeURIComponent(page.slug)}`}>{page.title}</Link>
        </li>
      ))}
    </ul>
  );
}
