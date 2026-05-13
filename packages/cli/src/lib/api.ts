import { type Profile, loadCredentials } from "./config.js";

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated. Run `neo auth login`.");
  }
}

function buildHeaders(creds: Profile, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.token}`,
    Accept: "application/json",
    ...extra,
  };
  if (creds.workspaceSlug) headers["X-Workspace"] = creds.workspaceSlug;
  return headers;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  optsCreds?: Profile
): Promise<ApiResponse<T>> {
  const creds = optsCreds ?? loadCredentials();
  if (!creds) throw new NotAuthenticatedError();

  const url = path.startsWith("http") ? path : `${creds.apiUrl}${path}`;
  const isJson = options.body && typeof options.body === "string";
  const headers = buildHeaders(creds, {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  });

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => null)) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiRequestUnauth<T = unknown>(
  apiUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const callerHeaders = (options.headers as Record<string, string>) ?? {};
  // Default to JSON body unless the caller explicitly chose a content type
  // (e.g. application/x-www-form-urlencoded for the OAuth token endpoint).
  const hasContentType = Object.keys(callerHeaders).some(
    (k) => k.toLowerCase() === "content-type"
  );
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body && typeof options.body === "string" && !hasContentType
      ? { "Content-Type": "application/json" }
      : {}),
    ...callerHeaders,
  };
  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => null)) as T;
  return { ok: res.ok, status: res.status, data };
}
