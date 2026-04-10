export async function apiFetch<T = unknown>(
  path: string,
  token: string | null,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data: data as T,
  };
}
