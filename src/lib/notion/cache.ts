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
  automaticRetryCooldownMs?: number;
  now?: () => number;
};

/** Process-local on purpose: the initial product has no persistence requirement. */
export class ManualSnapshotCache {
  private snapshot?: ManualSnapshot;
  private loadedAt = 0;
  private lastManualRefreshAt = Number.NEGATIVE_INFINITY;
  private pending?: Promise<ManualSnapshot>;
  private lastRefreshFailed = false;
  private lastRefreshFailedAt = Number.NEGATIVE_INFINITY;
  private readonly ttlMs: number;
  private readonly refreshCooldownMs: number;
  private readonly automaticRetryCooldownMs: number;
  private readonly now: () => number;

  constructor({
    ttlMs = 5 * 60_000,
    refreshCooldownMs = 30_000,
    automaticRetryCooldownMs = 30_000,
    now = Date.now,
  }: ManualSnapshotCacheOptions = {}) {
    this.ttlMs = ttlMs;
    this.refreshCooldownMs = refreshCooldownMs;
    this.automaticRetryCooldownMs = automaticRetryCooldownMs;
    this.now = now;
  }

  async get(loader: () => Promise<ManualSnapshot>, force = false): Promise<CachedManualSnapshot> {
    const time = this.now();
    const isFresh = this.snapshot !== undefined && time - this.loadedAt < this.ttlMs;
    if (!force && isFresh && !this.lastRefreshFailed) return { snapshot: this.snapshot!, source: "cache" };
    if (force && this.snapshot && time - this.lastManualRefreshAt < this.refreshCooldownMs) {
      return { snapshot: this.snapshot, source: "cache", warning: "refresh-cooldown" };
    }
    if (
      !force
      && this.snapshot
      && this.lastRefreshFailed
      && time - this.lastRefreshFailedAt < this.automaticRetryCooldownMs
    ) {
      return this.currentSnapshot();
    }

    if (force) this.lastManualRefreshAt = time;
    const loading = this.revalidate(loader);
    if (!force && this.snapshot) {
      void loading.catch(() => undefined);
      return this.currentSnapshot();
    }

    try {
      const snapshot = await loading;
      return { snapshot, source: "fresh" };
    } catch (error) {
      if (this.snapshot) return this.staleSnapshot();
      throw error;
    }
  }

  private revalidate(loader: () => Promise<ManualSnapshot>): Promise<ManualSnapshot> {
    if (this.pending) return this.pending;

    const loading = Promise.resolve().then(loader);
    this.pending = loading;
    void loading.then(
      (snapshot) => {
        this.snapshot = snapshot;
        this.loadedAt = this.now();
        this.lastRefreshFailed = false;
        this.lastRefreshFailedAt = Number.NEGATIVE_INFINITY;
      },
      () => {
        this.lastRefreshFailed = true;
        this.lastRefreshFailedAt = this.now();
      },
    ).finally(() => {
      if (this.pending === loading) this.pending = undefined;
    });
    return loading;
  }

  private currentSnapshot(): CachedManualSnapshot {
    if (!this.lastRefreshFailed) {
      return { snapshot: this.snapshot!, source: "cache" };
    }
    return {
      snapshot: this.snapshot!,
      source: "stale",
      warning: "stale-fallback",
    };
  }

  private staleSnapshot(): CachedManualSnapshot {
    return {
      snapshot: this.snapshot!,
      source: "stale",
      warning: "stale-fallback",
    };
  }
}
