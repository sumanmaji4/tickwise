"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorBox, Input, Label } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, session, ready } = useAuth();
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState("acme");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace("/tickets");
  }, [ready, session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(tenantSlug.trim(), email.trim(), password);
      router.replace("/tickets");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in to Tickwise</h1>
          <p className="mt-1 text-sm text-zinc-500">Support & SLA desk</p>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div>
          <Label htmlFor="tenant">Workspace</Label>
          <Input id="tenant" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <p className="text-center text-sm text-zinc-500">
          New here? <Link href="/signup" className="text-indigo-600 hover:underline">Create a workspace</Link>
        </p>
        <p className="text-xs text-zinc-500">
          Demo: workspace <code>acme</code> or <code>globex</code>, e.g. <code>alex@acme.test</code>,{" "}
          <code>manager@acme.test</code>, <code>admin@acme.test</code> with the seed password from <code>.env</code>.
        </p>
      </form>
    </main>
  );
}
