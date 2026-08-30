import { describe, expect, it } from "vitest";
import {
  MANUAL_PREFERENCES_STORAGE_KEY,
  MAX_FAVORITE_MANUALS,
  MAX_RECENT_MANUALS,
  type ManualPreferences,
  pagesInPreferenceOrder,
  readManualPreferences,
  recordRecentPage,
  toggleFavoritePage,
  writeManualPreferences,
} from "../src/lib/client-preferences";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const page = (id: string) => ({ id, title: `ページ${id}`, slug: `page-${id}` });

describe("client manual preferences", () => {
  it("fails open for malformed local data", () => {
    const storage = new MemoryStorage();
    storage.setItem(MANUAL_PREFERENCES_STORAGE_KEY, "not json");

    expect(readManualPreferences(storage)).toEqual({ favoritePageIds: [], recentPages: [] });
  });

  it("keeps favorite IDs and toggles them without storing server state", () => {
    const initial = { favoritePageIds: [], recentPages: [] };
    const added = toggleFavoritePage(initial, "lesson");

    expect(added.favoritePageIds).toEqual(["lesson"]);
    expect(toggleFavoritePage(added, "lesson").favoritePageIds).toEqual([]);
  });

  it("limits favorites to a compact field-use list", () => {
    let preferences: ManualPreferences = { favoritePageIds: [], recentPages: [] };
    for (let index = 0; index < 10; index += 1) {
      preferences = toggleFavoritePage(preferences, String(index));
    }
    expect(preferences.favoritePageIds).toHaveLength(MAX_FAVORITE_MANUALS);
    expect(preferences.favoritePageIds).toEqual(["9", "8", "7", "6", "5", "4", "3", "2"]);
  });

  it("keeps the newest eight recent pages and moves a repeated page to the front", () => {
    let preferences: ManualPreferences = { favoritePageIds: [], recentPages: [] };
    for (let index = 0; index < 10; index += 1) preferences = recordRecentPage(preferences, page(String(index)));

    expect(preferences.recentPages).toHaveLength(MAX_RECENT_MANUALS);
    expect(preferences.recentPages.map((item) => item.id)).toEqual(["9", "8", "7", "6", "5", "4", "3", "2"]);

    preferences = recordRecentPage(preferences, page("6"));
    expect(preferences.recentPages[0].id).toBe("6");
    expect(preferences.recentPages).toHaveLength(MAX_RECENT_MANUALS);
  });

  it("filters removed manuals and refreshes saved titles from the current snapshot", () => {
    const available = [page("a"), { ...page("b"), title: "現在のタイトル" }];
    expect(pagesInPreferenceOrder([page("missing"), { ...page("b"), title: "古いタイトル" }], available))
      .toEqual([{ id: "b", title: "現在のタイトル", slug: "page-b" }]);
  });

  it("writes only normalized values and tolerates unavailable storage", () => {
    const storage = new MemoryStorage();
    writeManualPreferences(storage, {
      favoritePageIds: ["a", "a", ""],
      recentPages: [page("a"), page("a")],
    });

    expect(readManualPreferences(storage)).toEqual({ favoritePageIds: ["a"], recentPages: [page("a")] });
    expect(() => writeManualPreferences({ getItem: () => null, setItem: () => { throw new Error("blocked"); } }, {
      favoritePageIds: [], recentPages: [],
    })).not.toThrow();
  });
});
