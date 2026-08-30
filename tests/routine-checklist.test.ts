import { describe, expect, it } from "vitest";
import {
  ROUTINE_CHECKLIST_STORAGE_KEY,
  clearRoutineChecklist,
  localDateKey,
  readRoutineChecklist,
  routineChecklistItemKey,
  routineChecklistItems,
  toggleRoutineChecklistItem,
} from "../src/lib/routine-checklist";
import type { ManualBlock, ManualRichText } from "../src/types/manual";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const text = (value: string): ManualRichText[] => [{
  text: value,
  style: { bold: false, italic: false, underline: false, strikethrough: false, code: false, color: "default" },
}];

const block = (id: string, type: "paragraph" | "bulleted_list_item" | "numbered_list_item", value: string, children: ManualBlock[] = []): ManualBlock => ({
  id,
  type,
  richText: text(value),
  children,
});

describe("routine checklist", () => {
  it("extracts only existing steps from the six routine pages, including nested blocks", () => {
    const blocks = [
      block("bullet", "bulleted_list_item", "出席簿を置く"),
      block("number", "numbered_list_item", "人数を確認する"),
      block("dots", "paragraph", "・ヘルパーを出す・コースロープを確認"),
      block("parent", "paragraph", "説明文", [block("nested", "bulleted_list_item", "子どもの名前を確認")]),
    ];

    const items = routineChecklistItems("lesson", "レッスン準備", blocks);
    expect(items.map((item) => item.text)).toEqual([
      "出席簿を置く",
      "人数を確認する",
      "ヘルパーを出す",
      "コースロープを確認",
      "子どもの名前を確認",
    ]);
    expect(items[0].key).toBe(routineChecklistItemKey("lesson", "bullet", "出席簿を置く"));
    expect(routineChecklistItems("lesson", "自由泳ぎ", blocks)).toEqual([]);
  });

  it("changes the storage identifier when the source block or wording changes", () => {
    expect(routineChecklistItemKey("page", "block-a", "確認")).not.toBe(
      routineChecklistItemKey("page", "block-b", "確認"),
    );
    expect(routineChecklistItemKey("page", "block-a", "確認")).not.toBe(
      routineChecklistItemKey("page", "block-a", "確認する"),
    );
  });

  it("resets saved checks when the local date changes or data is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(ROUTINE_CHECKLIST_STORAGE_KEY, JSON.stringify({
      day: "2026-08-29",
      checkedItemKeys: ["old"],
    }));

    expect(readRoutineChecklist(storage, new Date(2026, 7, 30, 9))).toEqual({
      day: "2026-08-30",
      checkedItemKeys: [],
    });

    storage.setItem(ROUTINE_CHECKLIST_STORAGE_KEY, "broken");
    expect(readRoutineChecklist(storage, new Date(2026, 7, 30, 9)).checkedItemKeys).toEqual([]);
  });

  it("toggles current-day checks and clears all checks manually", () => {
    const now = new Date(2026, 7, 30, 9);
    const changed = toggleRoutineChecklistItem({ day: "2026-08-29", checkedItemKeys: ["old"] }, "today", now);
    expect(changed).toEqual({ day: localDateKey(now), checkedItemKeys: ["today"] });
    expect(toggleRoutineChecklistItem(changed, "today", now).checkedItemKeys).toEqual([]);
    expect(clearRoutineChecklist(now)).toEqual({ day: "2026-08-30", checkedItemKeys: [] });
  });
});
