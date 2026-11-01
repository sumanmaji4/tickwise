"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorBox, Input, Label } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { setSession } from "@/lib/session";
import type { SessionResponse } from "@/lib/types";

/** Lowercase, hyphenated workspace slug suggested from the organisation name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    organizationName: "",
    slug: "",
    timezone: browserTimezone(),
    adminName: "",
    email: "",
    password: "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "organizationName" && !slugEdited) next.slug = slugify(value);
      return next;
    });
    if (key === "slug") setSlugEdited(true);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await apiFetch<SessionResponse>("/api/auth/signup", { method: "POST", token: null, body: form });
      setSession({ token: session.accessToken, expiresAt: session.expiresAt });
      router.replace("/admin");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create your support desk</h1>
          <p className="mt-1 text-sm text-zinc-500">You will be the first admin and can invite your team next.</p>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div>
          <Label htmlFor="org">Organisation name</Label>
          <Input id="org" required maxLength={200} value={form.organizationName} onChange={set("organizationName")} autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="slug">Workspace (used to sign in and in your support page URL)</Label>
          <Input id="slug" required minLength={2} maxLength={63} pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                 title="Lowercase letters, digits and inner hyphens" value={form.slug} onChange={set("slug")} />
          {form.slug && <p className="mt-1 text-xs text-zinc-500">Customers will use /support/{form.slug}</p>}
        </div>
        <div>
          <Label htmlFor="tz">Timezone (for business hours)</Label>
          {/* Prefilled from the browser, so it legitimately differs from the prerendered HTML. */}
          <Input id="tz" required value={form.timezone} onChange={set("timezone")} suppressHydrationWarning />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" required maxLength={200} value={form.adminName} onChange={set("adminName")} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required maxLength={320} value={form.email} onChange={set("email")} autoComplete="email" />
          </div>
        </div>
        <div>
          <Label htmlFor="password">Password (at least 12 characters)</Label>
          <Input id="password" type="password" required minLength={12} maxLength={72} value={form.password} onChange={set("password")} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</Button>
        <p className="text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="text-indigo-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
