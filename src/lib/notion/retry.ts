export type RetryableNotionError = {
  status?: number;
  headers?: Headers | Record<string, string | string[] | undefined>;
};

export type NotionRetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

function retryAfterMs(error: RetryableNotionError, now: () => number): number | undefined {
  const headers = error.headers;
  const raw = headers instanceof Headers
    ? headers.get("retry-after")
    : Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === "retry-after")?.[1];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - now());
}

function canRetry(error: unknown): error is RetryableNotionError {
  if (!error || typeof error !== "object") return true; // transient fetch failures often lack a status
  const status = (error as RetryableNotionError).status;
  return status === undefined || status === 429 || status >= 500;
}

/** Bounded retries for read-only Notion calls, including Retry-After on 429. */
export async function withNotionRetry<T>(operation: () => Promise<T>, options: NotionRetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxRetries || !canRetry(error)) throw error;
      const retryAfter = retryAfterMs(error, now);
      const delay = retryAfter ?? Math.min(maxDelayMs, initialDelayMs * 2 ** attempt);
      await sleep(delay);
    }
  }
}
