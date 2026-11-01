"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { relativeTime } from "@/lib/time";
import type { AppNotification, Role } from "@/lib/types";
import { Button, cx } from "./ui";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/tickets", label: "Queue", roles: ["AGENT", "MANAGER", "ADMIN"] },
  { href: "/dashboard", label: "Dashboard", roles: ["MANAGER", "ADMIN"] },
  { href: "/admin", label: "Settings", roles: ["ADMIN"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth();
  const { connected } = useRealtime();
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/tickets" className="font-semibold tracking-tight">Tickwise</Link>
          <span className="hidden text-sm text-zinc-500 sm:inline">{me?.tenantName}</span>
          <nav className="flex items-center gap-1">
            {NAV.filter((n) => me && n.roles.includes(me.role)).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "rounded-md px-2.5 py-1.5 text-sm",
                  pathname.startsWith(n.href)
                    ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={cx("h-2 w-2 rounded-full", connected ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600")}
              title={connected ? "Live updates connected" : "Live updates disconnected (reconnecting)"}
              aria-label={connected ? "Live" : "Offline"}
            />
            <Notifications />
            <span className="hidden text-sm text-zinc-600 md:inline dark:text-zinc-400">{me?.displayName}</span>
            <Button variant="ghost" onClick={logout}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <LiveToast />
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<AppNotification[]>("/api/notifications"),
    refetchInterval: 60_000,
  });
  const readAll = useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = list.data?.filter((n) => !n.readAt).length ?? 0;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications (${unread} unread)`}>
        <BellIcon />
        {unread > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-4 text-white">{unread}</span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="text-xs text-indigo-600 hover:underline disabled:opacity-50" disabled={unread === 0}
                    onClick={() => readAll.mutate()}>
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {list.data?.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">Nothing yet</li>}
            {list.data?.map((n) => (
              <li key={n.id} className={cx("border-b border-zinc-100 px-3 py-2 text-sm last:border-0 dark:border-zinc-900",
                !n.readAt && "bg-indigo-50/50 dark:bg-indigo-950/30")}>
                {n.ticketId ? (
                  <Link href={`/tickets/${n.ticketId}`} onClick={() => setOpen(false)} className="hover:underline">
                    {n.message}
                  </Link>
                ) : n.message}
                <div className="mt-0.5 text-xs text-zinc-500">{relativeTime(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Brief pop-up for notifications pushed over the WebSocket. */
function LiveToast() {
  const { latest, dismiss } = useRealtime();
  useEffect(() => {
    if (!latest) return;
    const id = window.setTimeout(dismiss, 8000);
    return () => window.clearTimeout(id);
  }, [latest, dismiss]);
  if (!latest) return null;
  const urgent = latest.type === "SLA_BREACHED";
  return (
    <div role="status" className={cx(
      "fixed bottom-4 right-4 z-30 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg",
      urgent ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
    )}>
      <div className="flex items-start gap-3">
        <p className="flex-1">
          {latest.ticketId ? <Link className="hover:underline" href={`/tickets/${latest.ticketId}`}>{latest.message}</Link> : latest.message}
        </p>
        <button onClick={dismiss} aria-label="Dismiss" className="text-zinc-500 hover:text-zinc-800">×</button>
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
