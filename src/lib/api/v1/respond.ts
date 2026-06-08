import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DOCS_URL } from "@/lib/constants/urls";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    param?: string;
    doc_url?: string;
  };
}

export function apiHeaders(requestId?: string): HeadersInit {
  const id = requestId ?? randomUUID();
  return {
    "X-Request-Id": id,
    "Neo-Api-Version": "1",
    "X-RateLimit-Limit": "10000",
    "X-RateLimit-Remaining": "9999",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
  };
}

export function jsonResponse(data: unknown, status = 200, requestId?: string) {
  return NextResponse.json(data, { status, headers: apiHeaders(requestId) });
}

export function listResponse<T>(
  data: T[],
  opts: { has_more: boolean; next_cursor?: string | null },
  requestId?: string
) {
  return jsonResponse(
    {
      object: "list",
      data,
      has_more: opts.has_more,
      next_cursor: opts.next_cursor ?? null,
    },
    200,
    requestId
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  param?: string,
  requestId?: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(param ? { param } : {}),
        doc_url: `${DOCS_URL}#errors`,
      },
    },
    { status, headers: apiHeaders(requestId) }
  );
}

export const unauthorized = (msg = "Invalid or missing API key.", rid?: string) =>
  apiError("authentication_required", msg, 401, "Authorization", rid);

export const forbidden = (msg: string, rid?: string) => apiError("forbidden", msg, 403, undefined, rid);

export const notFound = (resource: string, rid?: string) =>
  apiError("not_found", `${resource} not found.`, 404, undefined, rid);

export const badRequest = (msg: string, param?: string, rid?: string) =>
  apiError("invalid_request", msg, 400, param, rid);

export const tenantRequired = (rid?: string) =>
  apiError(
    "tenant_required",
    "X-Neo-Tenant-Id header is required for this operation.",
    400,
    "X-Neo-Tenant-Id",
    rid
  );

export const workspaceRequired = (rid?: string) =>
  apiError(
    "workspace_required",
    "X-Neo-Workspace header is required for this operation.",
    400,
    "X-Neo-Workspace",
    rid
  );

export function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
