import type { ManualSnapshot } from "@/src/types/manual";

export type CacheSource = "fresh" | "cache" | "stale";
export type CachedManualSnapshot = {
  snapshot: ManualSnapshot;
  source: CacheSource;
  warning?: "refresh-cooldown" | "stale-fallback";
};

export type ManualSnapshotCacheOptions = {
  ttlMs?: number;
  refreshCooldownMs?: number;
  now?: () => number;
};

/** Process-local on purpose: the initial product has no persistence requirement. */
export class ManualSnapshotCache {
  private snapshot?: ManualSnapshot;
  private loadedAt = 0;
  private lastManualRefreshAt = Number.NEGATIVE_INFINITY;
  private pending?: Promise<ManualSnapshot>;
  private readonly ttlMs: number;
  private readonly refreshCooldownMs: number;
  private readonly now: () => number;

  constructor({ ttlMs = 5 * 60_000, refreshCooldownMs = 30_000, now = Date.now }: ManualSnapshotCacheOptions = {}) {
    this.ttlMs = ttlMs;
    this.refreshCooldownMs = refreshCooldownMs;
    this.now = now;
  }

  async get(loader: () => Promise<ManualSnapshot>, force = false): Promise<CachedManualSnapshot> {
    const time = this.now();
    const isFresh = this.snapshot !== undefined && time - this.loadedAt < this.ttlMs;
    if (!force && isFresh) return { snapshot: this.snapshot!, source: "cache" };
    if (force && this.snapshot && time - this.lastManualRefreshAt < this.refreshCooldownMs) {
      return { snapshot: this.snapshot, source: "cache", warning: "refresh-cooldown" };
    }

    if (force) this.lastManualRefreshAt = time;
    const loading = this.pending ?? loader();
    this.pending = loading;
    try {
      const snapshot = await loading;
      this.snapshot = snapshot;
      this.loadedAt = this.now();
      return { snapshot, source: "fresh" };
    } catch (error) {
      if (this.snapshot) return { snapshot: this.snapshot, source: "stale", warning: "stale-fallback" };
      throw error;
    } finally {
      if (this.pending === loading) this.pending = undefined;
    }
  }
}
