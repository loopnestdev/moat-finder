import { supabase } from "./supabase";
import type { SSEEvent } from "../types/report.types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const base = (): string =>
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base()}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ error: "Request failed", code: "UNKNOWN" }))) as {
      error?: string;
      code?: string;
    };
    throw new ApiError(
      res.status,
      body.code ?? "UNKNOWN",
      body.error ?? "Request failed",
    );
  }
  return res;
}

export async function confirmResearch(
  ticker: string,
  runId: string,
  confirmed: boolean,
  correction?: string,
): Promise<void> {
  await apiFetch(`/api/v1/research/${ticker}/confirm`, {
    method: "POST",
    body: JSON.stringify({ runId, confirmed, correction }),
  });
}

export async function* streamResearch(
  ticker: string,
  method: "POST" | "PUT",
  signal: AbortSignal,
  provider?: string,
): AsyncGenerator<SSEEvent> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base()}/api/v1/research/${ticker}`, {
    method,
    headers,
    body: JSON.stringify({ provider: provider ?? "claude" }),
    signal,
  });

  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (line) {
        yield JSON.parse(line.slice(6)) as SSEEvent;
      }
    }
  }
}
