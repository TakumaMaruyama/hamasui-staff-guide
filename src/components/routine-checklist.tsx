"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  clearRoutineChecklist,
  emptyRoutineChecklistState,
  localDateKey,
  readRoutineChecklist,
  ROUTINE_CHECKLIST_STORAGE_KEY,
  routineChecklistItems,
  toggleRoutineChecklistItem,
  writeRoutineChecklist,
  type RoutineChecklistState,
} from "@/src/lib/routine-checklist";
import type { ManualBlock } from "@/src/types/manual";

type RoutineChecklistProps = {
  pageId: string;
  pageTitle: string;
  blocks: ManualBlock[];
};

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const serverChecklist = emptyRoutineChecklistState();
let cachedChecklist: RoutineChecklistState | undefined;
const checklistListeners = new Set<() => void>();

function notifyChecklistListeners() {
  checklistListeners.forEach((listener) => listener());
}

function currentChecklist(): RoutineChecklistState {
  if (typeof window === "undefined") return serverChecklist;
  if (!cachedChecklist) cachedChecklist = readRoutineChecklist(browserStorage());
  return cachedChecklist;
}

function subscribeChecklist(listener: () => void) {
  checklistListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ROUTINE_CHECKLIST_STORAGE_KEY) return;
    cachedChecklist = readRoutineChecklist(browserStorage());
    notifyChecklistListeners();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    checklistListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function saveChecklist(next: RoutineChecklistState): RoutineChecklistState {
  cachedChecklist = next;
  writeRoutineChecklist(browserStorage(), next);
  notifyChecklistListeners();
  return next;
}

function useRoutineChecklist() {
  return useSyncExternalStore(subscribeChecklist, currentChecklist, () => serverChecklist);
}

export function RoutineChecklist({ pageId, pageTitle, blocks }: RoutineChecklistProps) {
  const items = useMemo(
    () => routineChecklistItems(pageId, pageTitle, blocks),
    [blocks, pageId, pageTitle],
  );
  const state = useRoutineChecklist();

  useEffect(() => {
    let timer: number | undefined;
    const scheduleReset = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = window.setTimeout(() => {
        saveChecklist(clearRoutineChecklist());
        scheduleReset();
      }, Math.max(1, midnight.getTime() - now.getTime()));
    };
    scheduleReset();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  if (items.length === 0) return null;

  const today = localDateKey();
  const checkedKeys = state.day === today ? new Set(state.checkedItemKeys) : new Set<string>();
  const checkedCount = items.filter((item) => checkedKeys.has(item.key)).length;

  return (
    <section className="routine-checklist" aria-labelledby="routine-checklist-title">
      <div className="routine-checklist__header">
        <div>
          <h2 id="routine-checklist-title">チェックモード</h2>
          <p>この端末だけに保存されます。業務記録ではありません。</p>
        </div>
        <span aria-live="polite">{checkedCount}/{items.length} 完了</span>
      </div>
      <ul>
        {items.map((item) => {
          const checked = checkedKeys.has(item.key);
          return (
            <li key={item.key}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => saveChecklist(
                    toggleRoutineChecklistItem(currentChecklist(), item.key),
                  )}
                />
                <span>{item.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => saveChecklist(clearRoutineChecklist())}
      >
        すべて外す
      </button>
    </section>
  );
}
