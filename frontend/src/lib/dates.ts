// Dates are "YYYY-MM-DD" strings in the user's local time zone (never UTC),
// so "expires today" means today where the user is.

export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Adds months, clamping to the last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

export function daysUntil(iso: string, today: Date = new Date()): number {
  const ms = parseISODate(iso).getTime() - startOfDay(today).getTime();
  return Math.round(ms / 86_400_000);
}

export type ExpiryStatus = "expired" | "soon" | "ok";

export const SOON_DAYS = 7;

export function expiryStatus(iso: string, today: Date = new Date()): ExpiryStatus {
  const days = daysUntil(iso, today);
  if (days < 0) return "expired";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

export function formatExpiry(iso: string, today: Date = new Date()): string {
  const days = daysUntil(iso, today);
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return "Expired yesterday";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= SOON_DAYS) return `Expires in ${days} days`;
  const date = parseISODate(iso);
  const sameYear = date.getFullYear() === today.getFullYear();
  return `Expires ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

export const EXPIRY_CHIPS: { label: string; from: (today: Date) => Date }[] = [
  { label: "+3d", from: (t) => addDays(t, 3) },
  { label: "+1w", from: (t) => addDays(t, 7) },
  { label: "+2w", from: (t) => addDays(t, 14) },
  { label: "+1m", from: (t) => addMonths(t, 1) },
  { label: "+3m", from: (t) => addMonths(t, 3) },
  { label: "+6m", from: (t) => addMonths(t, 6) },
  { label: "+1y", from: (t) => addMonths(t, 12) },
];
