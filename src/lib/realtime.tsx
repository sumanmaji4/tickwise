"use client";

import { Client } from "@stomp/stompjs";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "./api";
import { useAuth } from "./auth";

export interface LiveNotification {
  id: string;
  message: string;
  ticketId?: number;
  type: string;
}

interface RealtimeValue {
  connected: boolean;
  latest: LiveNotification | null;
  dismiss: () => void;
}

const RealtimeContext = createContext<RealtimeValue>({ connected: false, latest: null, dismiss: () => {} });

const brokerUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws";

/**
 * Live updates over STOMP. Pushes are hints, not data: a ticket event invalidates the cached
 * queries, and TanStack Query refetches through the REST API (see ADR 0007). On reconnect
 * everything is refetched, so nothing missed while offline stays stale.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { session, me } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<LiveNotification | null>(null);

  useEffect(() => {
    if (!session || !me) return;
    const client = new Client({
      brokerURL: brokerUrl,
      connectHeaders: { Authorization: `Bearer ${session.token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      onConnect: () => {
        setConnected(true);
        queryClient.invalidateQueries();
        client.subscribe(`/topic/tenants/${me.tenantId}/tickets`, (frame) => {
          const event = JSON.parse(frame.body) as { ticketId?: number };
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          if (event.ticketId !== undefined) {
            queryClient.invalidateQueries({ queryKey: ["ticket", event.ticketId] });
          }
        });
        client.subscribe("/user/queue/notifications", (frame) => {
          const n = JSON.parse(frame.body) as LiveNotification;
          setLatest(n);
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();
    return () => {
      void client.deactivate();
      setConnected(false);
    };
  }, [session, me, queryClient]);

  return (
    <RealtimeContext.Provider value={{ connected, latest, dismiss: () => setLatest(null) }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext);
}
