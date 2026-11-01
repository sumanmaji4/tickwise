"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PriorityBadge, SlaBadge, StatusBadge, statusLabel } from "@/components/badges";
import { Button, Card, EmptyState, ErrorBox, Input, Select, Spinner, cx } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { relativeTime, useNow } from "@/lib/time";
import { PRIORITIES, type Page, type Priority, type Ticket, type TicketStatus } from "@/lib/types";

type Scope = "all" | "mine" | "unassigned";
type Sort = "SLA" | "CREATED" | "UPDATED";

interface Filters {
  scope: Scope;
  statuses: TicketStatus[];
  priority: Priority | "";
  q: string;
  breached: boolean;
  sort: Sort;
  page: number;
}

const ACTIVE: TicketStatus[] = ["NEW", "OPEN", "PENDING_CUSTOMER"];
const DEFAULTS: Filters = { scope: "all", statuses: ACTIVE, priority: "", q: "", breached: false, sort: "SLA", page: 0 };
const STORAGE_KEY = "tickwise.queue.filters";

function loadFilters(): Filters {
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    return saved ? ({ ...DEFAULTS, ...JSON.parse(saved), page: 0 } as Filters) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  f.statuses.forEach((s) => p.append("status", s));
  if (f.priority) p.set("priority", f.priority);
  if (f.scope === "mine") p.set("mine", "true");
  if (f.scope === "unassigned") p.set("unassigned", "true");
  if (f.breached) p.set("breached", "true");
  if (f.q.trim()) p.set("q", f.q.trim());
  p.set("sort", f.sort);
  p.set("page", String(f.page));
  p.set("size", "25");
  return p.toString();
}

export default function QueuePage() {
  // The console layout renders this page only on the client, so reading sessionStorage here is safe.
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [search, setSearch] = useState(filters.q);
  const queryClient = useQueryClient();
  const now = useNow(30_000);

  // Remember the agent's filters for this tab (a convenience, not state that must persist).
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);
  // Debounce free-text search.
  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search, page: 0 })), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 0 }));

  const tickets = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => apiFetch<Page<Ticket>>(`/api/tickets?${toQuery(filters)}`),
    placeholderData: keepPreviousData,
  });

  const claim = useMutation({
    mutationFn: (t: Ticket) => apiFetch<Ticket>(`/api/tickets/${t.id}/claim`, { method: "POST", body: { version: t.version } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const toggleStatus = (s: TicketStatus) =>
    update({ statuses: filters.statuses.includes(s) ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Ticket queue</h1>
          <Link href="/tickets/new"><Button>New ticket</Button></Link>
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950" role="tablist">
          {(["all", "mine", "unassigned"] as Scope[]).map((s) => (
            <button key={s} role="tab" aria-selected={filters.scope === s} onClick={() => update({ scope: s })}
                    className={cx("rounded-md px-3 py-1 text-sm capitalize",
                      filters.scope === s ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400")}>
              {s === "all" ? "All" : s === "mine" ? "Mine" : "Unassigned"}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Search subject…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          <Select className="w-36" value={filters.priority} onChange={(e) => update({ priority: e.target.value as Priority | "" })} aria-label="Priority">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </Select>
          <Select className="w-44" value={filters.sort} onChange={(e) => update({ sort: e.target.value as Sort })} aria-label="Sort">
            <option value="SLA">Sort: SLA due</option>
            <option value="CREATED">Sort: newest</option>
            <option value="UPDATED">Sort: recently updated</option>
          </Select>
          <label className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={filters.breached} onChange={(e) => update({ breached: e.target.checked })} />
            Breached only
          </label>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(statusLabel) as TicketStatus[]).map((s) => (
              <button key={s} onClick={() => toggleStatus(s)} aria-pressed={filters.statuses.includes(s)}
                      className={cx("rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset",
                        filters.statuses.includes(s)
                          ? "bg-indigo-600 text-white ring-indigo-600"
                          : "text-zinc-600 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-700")}>
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {claim.error && <ErrorBox>{errorMessage(claim.error)}</ErrorBox>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {tickets.isPending ? <div className="px-4"><Spinner /></div> : tickets.isError ? (
          <div className="p-4"><ErrorBox>{errorMessage(tickets.error)}</ErrorBox></div>
        ) : tickets.data.items.length === 0 ? <EmptyState>No tickets match these filters.</EmptyState> : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Ticket</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">SLA</th>
                <th className="px-2 py-2 font-medium">Assignee</th>
                <th className="px-4 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.data.items.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      <span className="text-zinc-400">#{t.id}</span> {t.subject}
                    </Link>
                    <div className="text-xs text-zinc-500">{t.customer.name ?? t.customer.email} · {t.channel === "EMAIL" ? "Email" : t.channel === "WEB" ? "Web" : "Agent"}</div>
                  </td>
                  <td className="px-2"><StatusBadge status={t.status} /></td>
                  <td className="px-2"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-2"><SlaBadge ticket={t} /></td>
                  <td className="px-2">
                    {t.assigneeName ?? (
                      <Button variant="secondary" className="py-0.5 text-xs" disabled={claim.isPending}
                              onClick={() => claim.mutate(t)}>Take</Button>
                    )}
                  </td>
                  <td className="px-4 text-right text-xs text-zinc-500">{relativeTime(t.updatedAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {tickets.data && tickets.data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>{tickets.data.totalElements} tickets</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={filters.page === 0} onClick={() => update({ page: filters.page - 1 })}>Previous</Button>
            <span>Page {filters.page + 1} of {tickets.data.totalPages}</span>
            <Button variant="secondary" disabled={filters.page + 1 >= tickets.data.totalPages}
                    onClick={() => update({ page: filters.page + 1 })}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
