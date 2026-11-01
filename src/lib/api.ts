// Thin client for the Spring Boot REST API. All data and business rules live in the backend;
// this module only handles transport, auth headers and the RFC 7807 error format.

import { clearSession, getSession } from "./session";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/** RFC 7807 problem details as returned by the backend. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  requestId?: string;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Request failed with status ${problem.status}`);
    this.name = "ApiError";
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Omit to use the current session; pass null for an anonymous call. */
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...init } = options;
  const bearer = token === undefined ? getSession()?.token : token;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json, application/problem+json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 && bearer) {
      // Expired or revoked token: drop the session; the console layout redirects to /login.
      clearSession();
    }
    throw new ApiError(await readProblem(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Downloads a protected file (attachments need the bearer token, so a plain link will not do). */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const bearer = getSession()?.token;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(await readProblem(response));
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  const fallback: ProblemDetails = {
    status: response.status,
    title: response.statusText,
    requestId: response.headers.get("X-Request-Id") ?? undefined,
  };
  try {
    const parsed = (await response.json()) as Partial<ProblemDetails>;
    return { ...fallback, ...parsed, status: parsed.status ?? response.status };
  } catch {
    return fallback;
  }
}

/** Human-readable message for an error from any query or mutation. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.problem.errors?.length) {
      return error.problem.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Cannot reach the server. Check your connection.";
  }
  return error instanceof Error ? error.message : "Something went wrong";
}
