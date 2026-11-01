"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, ErrorBox, Input, Label, Spinner } from "@/components/ui";
import { ApiError, apiFetch, errorMessage } from "@/lib/api";
import { setSession } from "@/lib/session";
import type { InvitationPreview, SessionResponse } from "@/lib/types";

function AcceptInvite() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => apiFetch<InvitationPreview>("/api/auth/invitations/preview", { method: "POST", token: null, body: { token } }),
    enabled: token.length > 0,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => apiFetch<SessionResponse>("/api/auth/invitations/accept", {
      method: "POST", token: null, body: { token, displayName, password },
    }),
    onSuccess: (session) => {
      setSession({ token: session.accessToken, expiresAt: session.expiresAt });
      router.replace("/tickets");
    },
  });

  if (!token || (preview.isError && preview.error instanceof ApiError && preview.error.status === 404)) {
    return (
      <Shell>
        <ErrorBox>This invitation link is invalid, has expired, or has already been used. Ask your admin for a new one.</ErrorBox>
        <p className="text-center text-sm"><Link href="/login" className="text-indigo-600 hover:underline">Go to sign in</Link></p>
      </Shell>
    );
  }
  if (preview.isPending) return <Shell><Spinner /></Shell>;
  if (preview.isError) return <Shell><ErrorBox>{errorMessage(preview.error)}</ErrorBox></Shell>;

  return (
    <Shell>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Join {preview.data.tenantName}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          You were invited as <strong>{preview.data.role.toLowerCase()}</strong> with <strong>{preview.data.email}</strong>.
          Your workspace is <code>{preview.data.tenantSlug}</code>.
        </p>
      </div>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); accept.mutate(); }}>
        {accept.isError && <ErrorBox>{errorMessage(accept.error)}</ErrorBox>}
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" required maxLength={200} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="password">Choose a password (at least 12 characters)</Label>
          <Input id="password" type="password" required minLength={12} maxLength={72} value={password}
                 onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={accept.isPending}>{accept.isPending ? "Joining…" : "Accept and sign in"}</Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {children}
      </div>
    </main>
  );
}

/** useSearchParams needs a Suspense boundary so the route can prerender its shell (Next.js 16). */
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Shell><Spinner /></Shell>}>
      <AcceptInvite />
    </Suspense>
  );
}
