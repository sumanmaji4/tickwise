"use client";

import { slaState, timerTone } from "@/lib/sla";
import { formatDuration, useNow } from "@/lib/time";
import type { Channel, Priority, Ticket, TicketStatus } from "@/lib/types";
import { Badge } from "./ui";

const statusTone = {
  NEW: "blue",
  OPEN: "indigo",
  PENDING_CUSTOMER: "orange",
  RESOLVED: "green",
  CLOSED: "gray",
} as const;

export const statusLabel: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  PENDING_CUSTOMER: "Pending customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

const priorityTone = { URGENT: "red", HIGH: "orange", MEDIUM: "gray", LOW: "gray" } as const;

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={priorityTone[priority]}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</Badge>;
}

/** Live countdown to the ticket's next SLA deadline: green → yellow at 80% → red when overdue. */
export function SlaBadge({ ticket }: { ticket: Ticket }) {
  const now = useNow();
  const state = slaState(ticket, now);
  switch (state.tone) {
    case "done":
      return ticket.slaBreached ? <Badge tone="red" title="An SLA target was missed">Missed</Badge> : <Badge tone="green">Met</Badge>;
    case "paused":
      return <Badge tone="gray" title="SLA clock paused while waiting on the customer">Paused</Badge>;
    case "none":
      return <Badge tone="gray">–</Badge>;
    case "breached":
      return (
        <Badge tone="red" title={`Due ${new Date(ticket.nextSlaDueAt!).toLocaleString()}`}>
          Overdue {formatDuration(state.remainingMs!)}
        </Badge>
      );
    default:
      return (
        <Badge tone={state.tone === "warning" ? "yellow" : "green"} title={`Due ${new Date(ticket.nextSlaDueAt!).toLocaleString()}`}>
          {formatDuration(state.remainingMs!)}
          {ticket.slaBreached && <span aria-label="an earlier target was missed"> · missed</span>}
        </Badge>
      );
  }
}

/** Countdown for one SLA timer on the ticket page. */
export function TimerCountdown({ dueAt, warningAt }: { dueAt?: string; warningAt?: string }) {
  const now = useNow();
  if (!dueAt) return null;
  const tone = timerTone(dueAt, warningAt, now);
  const remaining = new Date(dueAt).getTime() - now;
  return (
    <Badge tone={tone === "breached" ? "red" : tone === "warning" ? "yellow" : "green"}>
      {remaining > 0 ? `${formatDuration(remaining)} left` : `overdue ${formatDuration(remaining)}`}
    </Badge>
  );
}

/** How the ticket arrived, as a lowercase phrase for sentences ("via email"). */
export const channelLabel: Record<Channel, string> = {
  EMAIL: "email",
  WEB: "web form",
  AGENT: "agent (on the customer's behalf)",
};
