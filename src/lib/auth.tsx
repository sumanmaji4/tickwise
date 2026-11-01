"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import { clearSession, getSession, onSessionChange, setSession, type Session } from "./session";

const noopSubscribe = () => () => {};
import type { LoginResponse, Me, Role } from "./types";

interface AuthContextValue {
  /** null while the stored session is being read on the client. */
  ready: boolean;
  session: Session | null;
  me: Me | undefined;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  // The session is an external store (sessionStorage); the server snapshot is "not ready, no session",
  // and both values switch together on the client after hydration.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const session = useSyncExternalStore(onSessionChange, getSession, () => null);

  useEffect(() => onSessionChange((s) => {
    if (!s) queryClient.clear();
  }), [queryClient]);

  const me = useQuery({
    queryKey: ["me", session?.token],
    queryFn: () => apiFetch<Me>("/api/me"),
    enabled: !!session,
    staleTime: 5 * 60_000,
  });

  const login = useCallback(async (tenantSlug: string, email: string, password: string) => {
    const response = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      token: null,
      body: { tenantSlug, email, password },
    });
    setSession({ token: response.accessToken, expiresAt: response.expiresAt });
  }, []);

  const logout = useCallback(() => clearSession(), []);

  const hasRole = useCallback((...roles: Role[]) => !!me.data && roles.includes(me.data.role), [me.data]);

  return (
    <AuthContext.Provider value={{ ready, session, me: me.data, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
