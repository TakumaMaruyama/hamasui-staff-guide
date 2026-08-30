import type { ManualBlock } from "@/src/types/manual";

export const ROUTINE_CHECKLIST_STORAGE_KEY = "hamasui-routine-checklist:v1";

export const ROUTINE_CHECKLIST_PAGE_TITLES = [
  "開館準備",
  "出勤時",
  "レッスン準備",
  "片付け",
  "着替え",
  "閉館作業",
] as const;

export type RoutineChecklistItem = {
  blockId: string;
  text: string;
  key: string;
};

export type RoutineChecklistState = {
  day: string;
  checkedItemKeys: string[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const routineTitles = new Set<string>(ROUTINE_CHECKLIST_PAGE_TITLES);

export function isRoutineChecklistPage(title: string): boolean {
  return routineTitles.has(title.trim());
}

export function localDateKey(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A stable, compact non-cryptographic hash for a localStorage identifier. */
export function checklistTextHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function routineChecklistItemKey(pageId: string, blockId: string, text: string): string {
  return `${pageId}:${blockId}:${checklistTextHash(text)}`;
}

function blockText(block: ManualBlock): string {
  return "richText" in block ? block.richText.map((part) => part.text).join("") : "";
}

function dotSeparatedItems(text: string): string[] {
  if (!text.includes("・")) return [];
  return text
    .split("・")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Finds only source blocks that can already be read as steps. It does not
 * synthesize, reword, or write any task back to Notion.
 */
export function routineChecklistItems(
  pageId: string,
  pageTitle: string,
  blocks: ManualBlock[],
): RoutineChecklistItem[] {
  if (!pageId || !isRoutineChecklistPage(pageTitle)) return [];
  const items: RoutineChecklistItem[] = [];
  const itemKeys = new Set<string>();

  const add = (blockId: string, text: string) => {
    if (!text) return;
    const key = routineChecklistItemKey(pageId, blockId, text);
    if (itemKeys.has(key)) return;
    itemKeys.add(key);
    items.push({ blockId, text, key });
  };

  const visit = (source: ManualBlock[]) => {
    for (const block of source) {
      const text = blockText(block);
      if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
        add(block.id, text.trim());
      } else if (block.type === "paragraph") {
        for (const item of dotSeparatedItems(text)) add(block.id, item);
      }
      if (block.children.length > 0) visit(block.children);
    }
  };

  visit(blocks);
  return items;
}

export function emptyRoutineChecklistState(value = new Date()): RoutineChecklistState {
  return { day: localDateKey(value), checkedItemKeys: [] };
}

function normalizeRoutineChecklistState(value: unknown, currentDay: string): RoutineChecklistState {
  if (!value || typeof value !== "object") return { day: currentDay, checkedItemKeys: [] };
  const candidate = value as Record<string, unknown>;
  if (candidate.day !== currentDay || !Array.isArray(candidate.checkedItemKeys)) {
    return { day: currentDay, checkedItemKeys: [] };
  }
  return {
    day: currentDay,
    checkedItemKeys: [...new Set(candidate.checkedItemKeys.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    ))],
  };
}

export function readRoutineChecklist(
  storage?: StorageLike | null,
  now = new Date(),
): RoutineChecklistState {
  const currentDay = localDateKey(now);
  if (!storage) return { day: currentDay, checkedItemKeys: [] };
  try {
    const raw = storage.getItem(ROUTINE_CHECKLIST_STORAGE_KEY);
    return raw ? normalizeRoutineChecklistState(JSON.parse(raw), currentDay) : { day: currentDay, checkedItemKeys: [] };
  } catch {
    return { day: currentDay, checkedItemKeys: [] };
  }
}

export function writeRoutineChecklist(storage: StorageLike | null | undefined, state: RoutineChecklistState): void {
  if (!storage) return;
  try {
    storage.setItem(ROUTINE_CHECKLIST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // This optional device-only state must not affect source manual access.
  }
}

export function toggleRoutineChecklistItem(
  state: RoutineChecklistState,
  itemKey: string,
  now = new Date(),
): RoutineChecklistState {
  const current = state.day === localDateKey(now) ? state : emptyRoutineChecklistState(now);
  const checkedItemKeys = current.checkedItemKeys.includes(itemKey)
    ? current.checkedItemKeys.filter((key) => key !== itemKey)
    : [...current.checkedItemKeys, itemKey];
  return { ...current, checkedItemKeys };
}

export function clearRoutineChecklist(now = new Date()): RoutineChecklistState {
  return emptyRoutineChecklistState(now);
}
