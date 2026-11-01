"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorBox, Input, Label, Select, Textarea } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { PRIORITIES, type Priority, type Team, type Ticket } from "@/lib/types";

/** An agent opens a ticket on a customer's behalf (phone, chat, walk-in). The customer is created if new. */
export default function NewTicketPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ["directory", "teams"], queryFn: () => apiFetch<Team[]>("/api/directory/teams") });
  const [form, setForm] = useState({
    customerEmail: "",
    customerName: "",
    subject: "",
    description: "",
    priority: "MEDIUM" as Priority,
    teamId: "",
  });

  const create = useMutation({
    mutationFn: () => apiFetch<Ticket>("/api/tickets", {
      method: "POST",
      body: { ...form, customerName: form.customerName || null, teamId: form.teamId || null },
    }),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      router.push(`/tickets/${ticket.id}`);
    },
  });

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/tickets" className="text-sm text-zinc-500 hover:underline">← Queue</Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">New ticket</h1>
        <p className="text-sm text-zinc-500">For requests that arrive by phone or chat. The customer receives an email confirmation.</p>
      </div>
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          {create.isError && <ErrorBox>{errorMessage(create.error)}</ErrorBox>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cemail">Customer email</Label>
              <Input id="cemail" type="email" required maxLength={320} value={form.customerEmail} onChange={set("customerEmail")} />
            </div>
            <div>
              <Label htmlFor="cname">Customer name (optional)</Label>
              <Input id="cname" maxLength={200} value={form.customerName} onChange={set("customerName")} />
            </div>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" required maxLength={300} value={form.subject} onChange={set("subject")} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" required rows={6} maxLength={50000} value={form.description} onChange={set("description")}
                      placeholder="What did the customer report?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="team">Team</Label>
              <Select id="team" value={form.teamId} onChange={set("teamId")}>
                <option value="">Default routing</option>
                {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/tickets"><Button type="button" variant="secondary">Cancel</Button></Link>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create ticket"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
