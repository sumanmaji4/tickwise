"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { PriorityBadge, SlaBadge, StatusBadge, TimerCountdown, channelLabel, statusLabel } from "@/components/badges";
import { Button, Card, ErrorBox, Label, Select, Spinner, Textarea, cx } from "@/components/ui";
import { ApiError, apiFetch, downloadFile, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatDuration, formatMinutes } from "@/lib/time";
import {
  PRIORITIES, TRANSITIONS,
  type AuditEntry, type Message, type Person, type Priority, type SlaTimer, type Ticket, type TicketDetail, type TicketStatus,
} from "@/lib/types";

function TicketView() {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  const { me, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => apiFetch<TicketDetail>(`/api/tickets/${ticketId}`),
  });
  const messages = useQuery({
    queryKey: ["ticket", ticketId, "messages"],
    queryFn: () => apiFetch<Message[]>(`/api/tickets/${ticketId}/messages`),
  });
  const audit = useQuery({
    queryKey: ["ticket", ticketId, "audit"],
    queryFn: () => apiFetch<AuditEntry[]>(`/api/tickets/${ticketId}/audit`),
  });
  const agents = useQuery({
    queryKey: ["directory", "agents"],
    queryFn: () => apiFetch<Person[]>("/api/directory/agents"),
    enabled: hasRole("MANAGER", "ADMIN"),
    staleTime: 5 * 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
  const onError = (error: unknown) => {
    // 409 means someone else changed the ticket first: show it and load their version.
    if (error instanceof ApiError && error.isConflict) {
      setConflict(error.message);
      refresh();
    }
  };
  const onSuccess = () => {
    setConflict(null);
    refresh();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const update = useMutation({
    mutationFn: (change: { status?: TicketStatus; priority?: Priority }) =>
      apiFetch<Ticket>(`/api/tickets/${ticketId}`, { method: "PATCH", body: { version: detail.data!.ticket.version, ...change } }),
    onSuccess, onError,
  });
  const claim = useMutation({
    mutationFn: () => apiFetch<Ticket>(`/api/tickets/${ticketId}/claim`, { method: "POST", body: { version: detail.data!.ticket.version } }),
    onSuccess, onError,
  });
  const assign = useMutation({
    mutationFn: (assigneeId: string) => assigneeId
      ? apiFetch<Ticket>(`/api/tickets/${ticketId}/assignee`, { method: "PUT", body: { assigneeId, version: detail.data!.ticket.version } })
      : apiFetch<Ticket>(`/api/tickets/${ticketId}/assignee?version=${detail.data!.ticket.version}`, { method: "DELETE" }),
    onSuccess, onError,
  });
  const router = useRouter();
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/tickets/${ticketId}?version=${detail.data!.ticket.version}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      router.replace("/tickets");
    },
    onError,
  });

  if (detail.isPending) return <Spinner />;
  if (detail.isError) {
    return <ErrorBox>{detail.error instanceof ApiError && detail.error.status === 404 ? "Ticket not found." : errorMessage(detail.error)}</ErrorBox>;
  }

  const { ticket, sla } = detail.data;
  const mutationError = [update.error, claim.error, assign.error, remove.error]
    .find((e) => e && !(e instanceof ApiError && e.isConflict));
  const closed = ticket.status === "CLOSED";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/tickets" className="text-sm text-zinc-500 hover:underline">← Queue</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight"><span className="text-zinc-400">#{ticket.id}</span> {ticket.subject}</h1>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaBadge ticket={ticket} />
          {hasRole("ADMIN") && (
            <Button variant="ghost" className="ml-auto text-red-700 dark:text-red-400" disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete ticket #${ticket.id}? It disappears from the queue and reports; the audit trail is kept.`)) {
                        remove.mutate();
                      }
                    }}>
              Delete
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {ticket.customer.name ? `${ticket.customer.name} <${ticket.customer.email}>` : ticket.customer.email}
          {" · "}via {channelLabel[ticket.channel]} · opened {formatDateTime(ticket.createdAt)}
        </p>
      </div>

      {conflict && <ErrorBox>Someone else updated this ticket first ({conflict}). The latest version is loaded; please re-apply your change.</ErrorBox>}
      {mutationError ? <ErrorBox>{errorMessage(mutationError)}</ErrorBox> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Conversation">
            {messages.isPending ? <Spinner /> : messages.isError ? <ErrorBox>{errorMessage(messages.error)}</ErrorBox> : (
              <ol className="space-y-3">
                {messages.data.map((m) => <MessageBubble key={m.id} message={m} ticketId={ticketId} />)}
              </ol>
            )}
          </Card>
          {!closed && <ReplyBox ticketId={ticketId} onSent={onSuccess} />}
        </div>

        <aside className="space-y-4">
          <Card title="Details">
            <div className="space-y-3">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" value={ticket.status} disabled={closed || update.isPending}
                        onChange={(e) => update.mutate({ status: e.target.value as TicketStatus })}>
                  <option value={ticket.status}>{statusLabel[ticket.status]}</option>
                  {TRANSITIONS[ticket.status].map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select id="priority" value={ticket.priority} disabled={closed || update.isPending}
                        onChange={(e) => update.mutate({ priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                </Select>
                <p className="mt-1 text-xs text-zinc-500">Changing priority recalculates SLA deadlines.</p>
              </div>
              <div>
                <Label htmlFor="assignee">Assignee</Label>
                {hasRole("MANAGER", "ADMIN") ? (
                  <Select id="assignee" value={ticket.assigneeId ?? ""} disabled={closed || assign.isPending}
                          onChange={(e) => assign.mutate(e.target.value)}>
                    <option value="">Unassigned</option>
                    {agents.data?.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
                  </Select>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span>{ticket.assigneeName ?? "Unassigned"}</span>
                    {!ticket.assigneeId && !closed && (
                      <Button variant="secondary" onClick={() => claim.mutate()} disabled={claim.isPending}>Take it</Button>
                    )}
                  </div>
                )}
                {ticket.assigneeId === me?.userId && <p className="mt-1 text-xs text-zinc-500">Assigned to you.</p>}
              </div>
            </div>
          </Card>

          <Card title="SLA">
            <div className="space-y-4">
              <Timer label="First response" timer={sla.firstResponse} paused={ticket.slaPaused} />
              <Timer label="Resolution" timer={sla.resolution} paused={ticket.slaPaused} />
            </div>
          </Card>

          <Card title="History">
            {audit.isPending ? <Spinner /> : audit.isError ? <ErrorBox>{errorMessage(audit.error)}</ErrorBox> : (
              <ol className="space-y-2 text-sm">
                {audit.data.map((a) => (
                  <li key={a.id} className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
                    <div className={cx(a.type === "SLA_BREACHED" && "text-red-700 dark:text-red-400", a.type === "SLA_WARNING" && "text-amber-700 dark:text-amber-400")}>
                      {describeAudit(a, agents.data)}
                    </div>
                    <div className="text-xs text-zinc-500">{formatDateTime(a.createdAt)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({ message, ticketId }: { message: Message; ticketId: number }) {
  const outbound = message.direction === "OUTBOUND";
  const [downloadError, setDownloadError] = useState<string | null>(null);
  return (
    <li className={cx("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cx("max-w-[85%] rounded-lg px-3 py-2 text-sm",
        outbound ? "bg-indigo-50 text-zinc-900 dark:bg-indigo-950 dark:text-zinc-100" : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100")}>
        <div className="mb-1 text-xs text-zinc-500">
          {message.authorName ?? (outbound ? "Agent" : "Customer")} · {formatDateTime(message.createdAt)}
        </div>
        {/* Plain text only: customer content is never rendered as HTML. */}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <button className="text-xs text-indigo-700 hover:underline dark:text-indigo-300"
                        onClick={() => downloadFile(`/api/tickets/${ticketId}/attachments/${a.id}`, a.filename)
                          .catch((e) => setDownloadError(errorMessage(e)))}>
                  📎 {a.filename} ({Math.max(1, Math.round(a.sizeBytes / 1024))} KB)
                </button>
              </li>
            ))}
          </ul>
        )}
        {downloadError && <p className="mt-1 text-xs text-red-600">{downloadError}</p>}
      </div>
    </li>
  );
}

function ReplyBox({ ticketId, onSent }: { ticketId: number; onSent: () => void }) {
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: (status?: TicketStatus) =>
      apiFetch<Message>(`/api/tickets/${ticketId}/messages`, { method: "POST", body: { body, status } }),
    onSuccess: () => {
      setBody("");
      onSent();
    },
  });
  const disabled = send.isPending || body.trim().length === 0;
  return (
    <Card title="Reply to customer">
      <div className="space-y-2">
        {send.isError && <ErrorBox>{errorMessage(send.error)}</ErrorBox>}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} aria-label="Reply"
                  placeholder="Your reply is emailed to the customer." maxLength={50000} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={disabled} onClick={() => send.mutate("RESOLVED")}>Send & resolve</Button>
          <Button variant="secondary" disabled={disabled} onClick={() => send.mutate("PENDING_CUSTOMER")}>Send & wait for customer</Button>
          <Button disabled={disabled} onClick={() => send.mutate(undefined)}>Send</Button>
        </div>
      </div>
    </Card>
  );
}

function Timer({ label, timer, paused }: { label: string; timer: SlaTimer; paused: boolean }) {
  const used = Math.min(100, Math.round((timer.consumedSeconds / 60 / Math.max(1, timer.targetMinutes)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        {timer.state === "MET" ? (
          <span className={cx("text-xs", timer.breached ? "text-red-600" : "text-green-700 dark:text-green-400")}>
            {timer.breached ? "Met late" : "Met"} {formatDateTime(timer.metAt)}
          </span>
        ) : timer.state === "PAUSED" || paused ? (
          <span className="text-xs text-zinc-500">Paused</span>
        ) : (
          <TimerCountdown dueAt={timer.dueAt} warningAt={timer.warningAt} />
        )}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
        <div className={cx("h-full", timer.breached || used >= 100 ? "bg-red-500" : used >= 80 ? "bg-amber-500" : "bg-green-500")}
             style={{ width: `${used}%` }} />
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {formatDuration(timer.consumedSeconds * 1000)} of {formatMinutes(timer.targetMinutes)} business time used
        {timer.state === "RUNNING" && timer.dueAt ? ` · due ${formatDateTime(timer.dueAt)}` : ""}
      </p>
    </div>
  );
}

function describeAudit(a: AuditEntry, people: Person[] | undefined): string {
  const name = (id?: string) => (id ? people?.find((p) => p.id === id)?.displayName ?? "an agent" : "nobody");
  const d = a.details;
  switch (a.type) {
    case "CREATED": return `Created via ${channelLabel[d.channel as keyof typeof channelLabel] ?? d.channel}`;
    case "STATUS_CHANGED": return `Status ${pretty(d.from)} → ${pretty(d.to)}`;
    case "PRIORITY_CHANGED": return `Priority ${pretty(d.from)} → ${pretty(d.to)}`;
    case "ASSIGNED": return d.assigneeId ? `Assigned to ${name(d.assigneeId)}` : "Routed to team queue";
    case "UNASSIGNED": return "Unassigned";
    case "MESSAGE_RECEIVED": return "Customer replied";
    case "REPLY_SENT": return "Reply sent";
    case "SLA_WARNING": return `SLA warning: ${pretty(d.metric)} due ${formatDateTime(d.dueAt)}`;
    case "SLA_BREACHED": return `SLA breached: ${pretty(d.metric)}`;
    default: return a.type;
  }
}

function pretty(value: string | undefined): string {
  return value ? value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ") : "–";
}

/** useParams needs a Suspense boundary so the route can prerender its shell (Next.js 16). */
export default function TicketPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <TicketView />
    </Suspense>
  );
}
