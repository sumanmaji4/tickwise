"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { ready, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready) router.replace(session ? "/tickets" : "/login");
  }, [ready, session, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Spinner />
    </main>
  );
}
