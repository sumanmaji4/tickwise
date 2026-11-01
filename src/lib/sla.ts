import type { Ticket } from "./types";

export type SlaTone = "ok" | "warning" | "breached" | "paused" | "done" | "none";

export interface SlaState {
  tone: SlaTone;
  /** Milliseconds until the next deadline (negative once overdue). */
  remainingMs?: number;
}

/**
 * Badge colour for the next running deadline: green until the 80% warning point, yellow
 * until the deadline, red after it (or when the server has recorded a breach on the running
 * target). The server computes the instants in business time; the browser only compares them
 * with the current time.
 */
export function slaState(ticket: Ticket, now: number): SlaState {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") return { tone: "done" };
  if (ticket.slaPaused) return { tone: "paused" };
  if (!ticket.nextSlaDueAt) return { tone: "none" };
  const due = new Date(ticket.nextSlaDueAt).getTime();
  const remainingMs = due - now;
  if (remainingMs <= 0) return { tone: "breached", remainingMs };
  const warning = ticket.nextSlaWarningAt ? new Date(ticket.nextSlaWarningAt).getTime() : Number.POSITIVE_INFINITY;
  return { tone: now >= warning ? "warning" : "ok", remainingMs };
}

export function timerTone(dueAt: string | undefined, warningAt: string | undefined, now: number): SlaTone {
  if (!dueAt) return "none";
  const due = new Date(dueAt).getTime();
  if (now >= due) return "breached";
  if (warningAt && now >= new Date(warningAt).getTime()) return "warning";
  return "ok";
}
