import "server-only";

import { requireAuth } from "@/src/lib/auth";
import {
  getManualRepository,
  type CachedManualSnapshot,
} from "@/src/lib/notion";

export type ManualLoadResult =
  | { ok: true; data: CachedManualSnapshot }
  | { ok: false };

function logManualLoadError(error: unknown): void {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const safeDetails = {
    name: typeof record.name === "string" ? record.name : "Error",
    code: typeof record.code === "string" ? record.code : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  };
  console.error("Manual data load failed", safeDetails);
}

export async function loadManualSnapshot(force = false): Promise<ManualLoadResult> {
  await requireAuth();
  try {
    return { ok: true, data: await getManualRepository().getSnapshot(force) };
  } catch (error) {
    logManualLoadError(error);
    return { ok: false };
  }
}
