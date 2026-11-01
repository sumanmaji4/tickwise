"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Every console screen needs a staff session. The API enforces access too; this only routes. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { ready, session, me } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  if (!ready || !session || !me) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Spinner />
      </main>
    );
  }
  return <AppShell>{children}</AppShell>;
}
