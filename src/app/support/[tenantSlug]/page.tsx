"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, ErrorBox, Input, Label, Spinner, Textarea } from "@/components/ui";
import { ApiError, apiFetch, errorMessage } from "@/lib/api";

interface TenantInfo {
  slug: string;
  name: string;
}

interface Submitted {
  ticketId?: number;
  reference?: string;
}

/** Public customer form. Anonymous: no session token is sent. */
function SupportForm() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });

  const tenant = useQuery({
    queryKey: ["public-tenant", tenantSlug],
    queryFn: () => apiFetch<TenantInfo>(`/api/public/${encodeURIComponent(tenantSlug)}`, { token: null }),
  });

  const submit = useMutation({
    mutationFn: () => apiFetch<Submitted>(`/api/public/${encodeURIComponent(tenantSlug)}/tickets`, {
      method: "POST", token: null, body: form,
    }),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (tenant.isPending) return <main className="flex flex-1 items-center justify-center"><Spinner /></main>;
  if (tenant.isError) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
        <ErrorBox>{tenant.error instanceof ApiError && tenant.error.status === 404 ? "This support page does not exist." : errorMessage(tenant.error)}</ErrorBox>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.data.name} support</h1>
        <p className="mt-1 text-sm text-zinc-500">Tell us what is going on and we will get back to you by email.</p>

        {submit.isSuccess ? (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-5 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
            <p className="font-medium">Thanks, we have received your request.</p>
            {submit.data.reference && <p className="mt-1 text-sm">Your reference is <strong>{submit.data.reference}</strong>. A confirmation email is on its way.</p>}
          </div>
        ) : (
          <form className="mt-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
                onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
            {submit.isError && (
              <ErrorBox>
                {submit.error instanceof ApiError && submit.error.status === 429
                  ? "You have sent several requests in a short time. Please wait a minute and try again."
                  : errorMessage(submit.error)}
              </ErrorBox>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={form.name} onChange={set("name")} required maxLength={200} autoComplete="name" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} required maxLength={320} autoComplete="email" />
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={form.subject} onChange={set("subject")} required maxLength={300} />
            </div>
            <div>
              <Label htmlFor="message">How can we help?</Label>
              <Textarea id="message" rows={6} value={form.message} onChange={set("message")} required maxLength={20000} />
            </div>
            {/* Honeypot: invisible to people, tempting to bots. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </div>
            <Button type="submit" disabled={submit.isPending}>{submit.isPending ? "Sending…" : "Send request"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}

/** useParams needs a Suspense boundary so the route can prerender its shell (Next.js 16). */
export default function SupportPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SupportForm />
    </Suspense>
  );
}
