"use client";

import { useEffect, useState } from "react";

/** Re-renders every `intervalMs` so countdowns stay live. One timer per mounted component. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Compact duration: "45s", "12m", "3h 05m", "2d 4h". */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Business minutes as "1h 30m" / "2d 3h" (a business "day" is still 24 h here, kept simple and explicit). */
export function formatMinutes(minutes: number | undefined | null): string {
  if (minutes === undefined || minutes === null) return "–";
  return formatDuration(minutes * 60_000);
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso: string | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "–";
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const text = formatDuration(diff);
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export function formatPercent(rate: number | undefined | null): string {
  return rate === undefined || rate === null ? "–" : `${Math.round(rate * 1000) / 10}%`;
}
