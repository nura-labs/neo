import { auth } from "@/lib/auth/firebase-client";

const WORKSPACE_LS_KEY = "neo-workspace";

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  await auth.authStateReady();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Attach the active workspace slug so workspace-scoped routes resolve it
  // without each caller having to thread it through.
  if (typeof window !== "undefined" && !headers["X-Workspace"]) {
    const slug = window.localStorage.getItem(WORKSPACE_LS_KEY);
    if (slug) headers["X-Workspace"] = slug;
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
