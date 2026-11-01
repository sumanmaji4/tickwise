"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorBox, Input, Label, Select, Spinner } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DAYS, PRIORITIES,
  type AssignmentSettings, type BusinessCalendar, type DayOfWeek, type Invitation, type Role, type SlaPolicy, type Team, type User,
} from "@/lib/types";

const TABS = ["Business hours", "Holidays", "SLA policies", "Teams", "Agents", "Routing"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>("Business hours");
  if (!hasRole("ADMIN")) return <ErrorBox>Settings are available to administrators only.</ErrorBox>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? "border-indigo-600 font-medium text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Business hours" && <HoursTab />}
      {tab === "Holidays" && <HolidaysTab />}
      {tab === "SLA policies" && <PoliciesTab />}
      {tab === "Teams" && <TeamsTab />}
      {tab === "Agents" && <AgentsTab />}
      {tab === "Routing" && <RoutingTab />}
    </div>
  );
}

function useCalendar() {
  return useQuery({ queryKey: ["admin", "calendar"], queryFn: () => apiFetch<BusinessCalendar>("/api/admin/sla/calendar") });
}

const hhmm = (t: string) => t.slice(0, 5);
const dayLabel = (d: DayOfWeek) => d.charAt(0) + d.slice(1).toLowerCase();

interface DayRow {
  enabled: boolean;
  start: string;
  end: string;
}

function HoursTab() {
  const calendar = useCalendar();
  if (calendar.isPending) return <Spinner />;
  if (calendar.isError) return <ErrorBox>{errorMessage(calendar.error)}</ErrorBox>;
  // Keyed on the saved data so a successful save re-initialises the form from the server's view.
  return <HoursForm key={JSON.stringify(calendar.data)} calendar={calendar.data} />;
}

function rowsFrom(calendar: BusinessCalendar): Record<DayOfWeek, DayRow> {
  const rows = {} as Record<DayOfWeek, DayRow>;
  for (const d of DAYS) {
    const h = calendar.hours.find((x) => x.dayOfWeek === d);
    rows[d] = h ? { enabled: true, start: hhmm(h.start), end: hhmm(h.end) } : { enabled: false, start: "09:00", end: "17:00" };
  }
  return rows;
}

function HoursForm({ calendar }: { calendar: BusinessCalendar }) {
  const queryClient = useQueryClient();
  const [timezone, setTimezone] = useState(calendar.timezone);
  const [rows, setRows] = useState(() => rowsFrom(calendar));

  const save = useMutation({
    mutationFn: () => apiFetch<BusinessCalendar>("/api/admin/sla/calendar", {
      method: "PUT",
      body: {
        timezone,
        hours: DAYS.filter((d) => rows[d].enabled).map((d) => ({ dayOfWeek: d, start: rows[d].start, end: rows[d].end })),
      },
    }),
    onSuccess: (saved) => queryClient.setQueryData(["admin", "calendar"], saved),
  });

  const set = (d: DayOfWeek, patch: Partial<DayRow>) => setRows({ ...rows, [d]: { ...rows[d], ...patch } });

  return (
    <Card title="Working hours" actions={<Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>}>
      <div className="space-y-4">
        {save.isError && <ErrorBox>{errorMessage(save.error)}</ErrorBox>}
        <div className="max-w-xs">
          <Label htmlFor="tz">Timezone (IANA, e.g. America/New_York)</Label>
          <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>
        <table className="text-sm">
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td className="py-1 pr-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rows[d].enabled} onChange={(e) => set(d, { enabled: e.target.checked })} />
                    {dayLabel(d)}
                  </label>
                </td>
                <td className="py-1 pr-2"><Input type="time" aria-label={`${dayLabel(d)} start`} value={rows[d].start} disabled={!rows[d].enabled} onChange={(e) => set(d, { start: e.target.value })} /></td>
                <td className="py-1 pr-2 text-zinc-500">to</td>
                <td className="py-1"><Input type="time" aria-label={`${dayLabel(d)} end`} value={rows[d].end} disabled={!rows[d].enabled} onChange={(e) => set(d, { end: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-500">
          An end time earlier than the start runs past midnight (overnight shift); 00:00–00:00 is the whole day.
          Running SLA clocks use new hours from their next change.
        </p>
      </div>
    </Card>
  );
}

function HolidaysTab() {
  const calendar = useCalendar();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  const add = useMutation({
    mutationFn: () => apiFetch("/api/admin/sla/calendar/holidays", { method: "POST", body: { date, name } }),
    onSuccess: () => { setDate(""); setName(""); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (d: string) => apiFetch(`/api/admin/sla/calendar/holidays/${d}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  if (calendar.isPending) return <Spinner />;
  if (calendar.isError) return <ErrorBox>{errorMessage(calendar.error)}</ErrorBox>;
  return (
    <Card title="Holidays (no business time)">
      <div className="space-y-4">
        {(add.error || remove.error) && <ErrorBox>{errorMessage(add.error ?? remove.error)}</ErrorBox>}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div><Label htmlFor="hdate">Date</Label><Input id="hdate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="min-w-48 flex-1"><Label htmlFor="hname">Name</Label><Input id="hname" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Button type="submit" disabled={add.isPending}>Add</Button>
        </form>
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
          {calendar.data.holidays.length === 0 && <li className="py-2 text-zinc-500">No holidays.</li>}
          {calendar.data.holidays.map((h) => (
            <li key={h.date} className="flex items-center justify-between py-2">
              <span><span className="tabular-nums">{h.date}</span> · {h.name}</span>
              <Button variant="ghost" onClick={() => remove.mutate(h.date)}>Remove</Button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function PoliciesTab() {
  const queryClient = useQueryClient();
  const policies = useQuery({ queryKey: ["admin", "policies"], queryFn: () => apiFetch<SlaPolicy[]>("/api/admin/sla/policies") });
  const [edits, setEdits] = useState<Record<string, SlaPolicy>>({});
  const save = useMutation({
    mutationFn: (p: SlaPolicy) => apiFetch<SlaPolicy>(`/api/admin/sla/policies/${p.priority}`, {
      method: "PUT", body: { firstResponseMinutes: p.firstResponseMinutes, resolutionMinutes: p.resolutionMinutes },
    }),
    onSuccess: (p) => {
      setEdits((e) => { const next = { ...e }; delete next[p.priority]; return next; });
      queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
    },
  });
  if (policies.isPending) return <Spinner />;
  if (policies.isError) return <ErrorBox>{errorMessage(policies.error)}</ErrorBox>;
  const byPriority = Object.fromEntries(policies.data.map((p) => [p.priority, p]));
  return (
    <Card title="SLA targets (business minutes)">
      {save.isError && <div className="mb-3"><ErrorBox>{errorMessage(save.error)}</ErrorBox></div>}
      <table className="text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr><th className="pb-2 pr-4">Priority</th><th className="pb-2 pr-2">First response</th><th className="pb-2 pr-2">Resolution</th><th /></tr>
        </thead>
        <tbody>
          {PRIORITIES.map((priority) => {
            const p = edits[priority] ?? byPriority[priority];
            if (!p) return null;
            const change = (patch: Partial<SlaPolicy>) => setEdits((e) => ({ ...e, [priority]: { ...p, ...patch } }));
            return (
              <tr key={priority}>
                <td className="py-1 pr-4 font-medium">{priority.charAt(0) + priority.slice(1).toLowerCase()}</td>
                <td className="py-1 pr-2"><Input type="number" min={1} max={525600} className="w-28" aria-label={`${priority} first response minutes`}
                                                 value={p.firstResponseMinutes} onChange={(e) => change({ firstResponseMinutes: Number(e.target.value) })} /></td>
                <td className="py-1 pr-2"><Input type="number" min={1} max={525600} className="w-28" aria-label={`${priority} resolution minutes`}
                                                 value={p.resolutionMinutes} onChange={(e) => change({ resolutionMinutes: Number(e.target.value) })} /></td>
                <td className="py-1">{edits[priority] && <Button onClick={() => save.mutate(edits[priority])} disabled={save.isPending}>Save</Button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-zinc-500">New targets apply to new and re-prioritised tickets; running clocks keep their target.</p>
    </Card>
  );
}

function useTeams() {
  return useQuery({ queryKey: ["admin", "teams"], queryFn: () => apiFetch<Team[]>("/api/admin/teams") });
}

function TeamsTab() {
  const teams = useTeams();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => apiFetch<Team>("/api/admin/teams", { method: "POST", body: { name } }),
    onSuccess: () => { setName(""); queryClient.invalidateQueries({ queryKey: ["admin", "teams"] }); },
  });
  return (
    <Card title="Teams">
      <div className="space-y-4">
        {create.isError && <ErrorBox>{errorMessage(create.error)}</ErrorBox>}
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="max-w-xs flex-1"><Label htmlFor="team">New team</Label><Input id="team" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Button type="submit" disabled={create.isPending}>Create</Button>
        </form>
        {teams.isPending ? <Spinner /> : teams.isError ? <ErrorBox>{errorMessage(teams.error)}</ErrorBox> : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {teams.data.map((t) => <li key={t.id} className="py-2">{t.name}</li>)}
          </ul>
        )}
      </div>
    </Card>
  );
}

const ROLES: Role[] = ["AGENT", "MANAGER", "ADMIN"];

function AgentsTab() {
  const teams = useTeams();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => apiFetch<User[]>("/api/admin/users") });
  const invitations = useQuery({ queryKey: ["admin", "invitations"], queryFn: () => apiFetch<Invitation[]>("/api/admin/invitations") });
  const empty = { email: "", role: "AGENT" as Role, teamId: "", maxOpenTickets: 10 };
  const [form, setForm] = useState(empty);
  const [lastLink, setLastLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const invite = useMutation({
    mutationFn: () => apiFetch<{ invitation: Invitation; inviteUrl: string }>("/api/admin/invitations", {
      method: "POST", body: { ...form, teamId: form.teamId || null },
    }),
    onSuccess: (res) => {
      setLastLink({ email: res.invitation.email, url: res.inviteUrl });
      setCopied(false);
      setForm(empty);
      queryClient.invalidateQueries({ queryKey: ["admin", "invitations"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/invitations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });
  const teamName = (id?: string) => teams.data?.find((t) => t.id === id)?.name ?? "–";

  return (
    <div className="space-y-4">
      <Card title="Invite a teammate">
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
          {invite.isError && <div className="sm:col-span-4"><ErrorBox>{errorMessage(invite.error)}</ErrorBox></div>}
          <div className="sm:col-span-2"><Label htmlFor="uemail">Email</Label><Input id="uemail" type="email" required maxLength={320} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label htmlFor="urole">Role</Label>
            <Select id="urole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
            </Select>
          </div>
          <div><Label htmlFor="uteam">Team</Label>
            <Select id="uteam" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">No team</option>
              {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div><Label htmlFor="ucap">Max open tickets</Label><Input id="ucap" type="number" min={0} max={1000} value={form.maxOpenTickets} onChange={(e) => setForm({ ...form, maxOpenTickets: Number(e.target.value) })} /></div>
          <div className="flex items-end sm:col-span-3"><Button type="submit" disabled={invite.isPending}>{invite.isPending ? "Sending…" : "Send invitation"}</Button></div>
        </form>
        {lastLink && (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p>Invitation emailed to <strong>{lastLink.email}</strong>. You can also share this single-use link (valid 7 days):</p>
            <div className="mt-2 flex gap-2">
              <Input readOnly value={lastLink.url} aria-label="Invitation link" onFocus={(e) => e.target.select()} />
              <Button type="button" variant="secondary" onClick={() => {
                void navigator.clipboard?.writeText(lastLink.url).then(() => setCopied(true));
              }}>{copied ? "Copied" : "Copy"}</Button>
            </div>
          </div>
        )}
      </Card>
      <Card title="Pending invitations">
        {invitations.isPending ? <Spinner /> : invitations.isError ? <ErrorBox>{errorMessage(invitations.error)}</ErrorBox> :
          invitations.data.length === 0 ? <p className="text-sm text-zinc-500">No open invitations.</p> : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
              {revoke.isError && <li className="py-2"><ErrorBox>{errorMessage(revoke.error)}</ErrorBox></li>}
              {invitations.data.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{i.email} · {i.role.toLowerCase()} · {teamName(i.teamId)}
                    <span className="text-zinc-500"> · expires {new Date(i.expiresAt).toLocaleDateString()}</span></span>
                  <Button variant="ghost" onClick={() => revoke.mutate(i.id)} disabled={revoke.isPending}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
      </Card>
      <Card title="Users">
        {users.isPending ? <Spinner /> : users.isError ? <ErrorBox>{errorMessage(users.error)}</ErrorBox> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th><th className="pb-2">Team</th><th className="pb-2 text-right">Capacity</th></tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="py-2">{u.displayName}</td><td>{u.email}</td><td>{u.role.toLowerCase()}</td>
                    <td>{teamName(u.teamId)}</td><td className="text-right tabular-nums">{u.maxOpenTickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function RoutingTab() {
  const settings = useQuery({ queryKey: ["admin", "routing"], queryFn: () => apiFetch<AssignmentSettings>("/api/admin/assignment-settings") });
  if (settings.isPending) return <Spinner />;
  if (settings.isError) return <ErrorBox>{errorMessage(settings.error)}</ErrorBox>;
  return <RoutingForm key={JSON.stringify(settings.data)} initial={settings.data} />;
}

function RoutingForm({ initial }: { initial: AssignmentSettings }) {
  const teams = useTeams();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const save = useMutation({
    mutationFn: () => apiFetch<AssignmentSettings>("/api/admin/assignment-settings", {
      method: "PUT", body: { defaultTeamId: draft.defaultTeamId || null, autoAssign: draft.autoAssign },
    }),
    onSuccess: (saved) => queryClient.setQueryData(["admin", "routing"], saved),
  });
  return (
    <Card title="Routing" actions={<Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>}>
      <div className="max-w-sm space-y-3">
        {save.isError && <ErrorBox>{errorMessage(save.error)}</ErrorBox>}
        <div>
          <Label htmlFor="dteam">Default team for new tickets</Label>
          <Select id="dteam" value={draft.defaultTeamId ?? ""} onChange={(e) => setDraft({ ...draft, defaultTeamId: e.target.value || undefined })}>
            <option value="">None (unrouted queue)</option>
            {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.autoAssign} onChange={(e) => setDraft({ ...draft, autoAssign: e.target.checked })} />
          Auto-assign round-robin, skipping agents at capacity
        </label>
      </div>
    </Card>
  );
}
