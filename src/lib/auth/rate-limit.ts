const attempts = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_ENTRIES = 5_000;

export const LOGIN_RETRY_AFTER_SECONDS = Math.ceil(WINDOW_MS / 1_000);

function prune(now: number): void {
  for (const [key, times] of attempts) {
    const recent = times.filter((time) => now - time < WINDOW_MS);
    if (recent.length === 0) attempts.delete(key);
    else attempts.set(key, recent);
  }
  while (attempts.size > MAX_ENTRIES) {
    const oldestKey = attempts.keys().next().value;
    if (typeof oldestKey !== "string") break;
    attempts.delete(oldestKey);
  }
}

export function loginRateLimitKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isRateLimited(key: string, now = Date.now()): boolean {
  prune(now);
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  attempts.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}

export function recordLoginAttempt(key: string, now = Date.now()): void {
  prune(now);
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
