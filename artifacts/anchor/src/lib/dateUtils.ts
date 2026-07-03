export const DAY_MS = 86_400_000;

export function formatDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatTime(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function daysSince(start: string): number {
  const startMs = new Date(start + "T00:00:00").getTime();
  const nowMs = Date.now();
  if (isNaN(startMs) || startMs > nowMs) return 0;
  return Math.floor((nowMs - startMs) / DAY_MS);
}
