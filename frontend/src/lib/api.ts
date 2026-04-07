const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}${path}`, init);
}
