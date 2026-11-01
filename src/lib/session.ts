// The access token lives in memory and sessionStorage only (never localStorage; see ADR 0003),
// so it is gone when the tab closes and is not shared across tabs.

const KEY = "tickwise.session";

export interface Session {
  token: string;
  expiresAt: string;
}

type Listener = (session: Session | null) => void;

let current: Session | null = null;
let loaded = false;
const listeners = new Set<Listener>();

function read(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return new Date(parsed.expiresAt).getTime() > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (!loaded && typeof window !== "undefined") {
    current = read();
    loaded = true;
  }
  // Pure read (it doubles as a useSyncExternalStore snapshot): an expired token surfaces as a
  // 401 on the next request, which clears the session there.
  return current;
}

export function setSession(session: Session): void {
  current = session;
  loaded = true;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private mode): the in-memory session still works for this page.
  }
  listeners.forEach((l) => l(session));
}

export function clearSession(): void {
  current = null;
  loaded = true;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(null));
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
