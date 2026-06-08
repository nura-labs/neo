import { hashToken } from "@/lib/auth/token";
import {
  getAccountTokenByHash,
  touchAccountTokenLastUsed,
  getPlatformWorkspaceBySlug,
  getTenantByExternalIdOrSlug,
} from "@/lib/platform/queries";
import { apiError } from "@/lib/api/v1/respond";
import type { PlatformOrg, Tenant, Workspace, AccountApiToken } from "@/lib/db/schema";

export interface PlatformContext {
  org: PlatformOrg;
  token: AccountApiToken;
  workspace: Workspace | null;
  tenant: Tenant | null;
  scopes: string[];
}

function parseBearer(request: Request): string | null {
  const h = request.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

function hasScope(scopes: string[], required: string): boolean {
  if (scopes.includes("admin")) return true;
  return scopes.includes(required);
}

export async function getPlatformContext(
  request: Request,
  opts: { requireWorkspace?: boolean; requireTenant?: boolean; scope?: "read" | "write" | "admin" } = {}
): Promise<PlatformContext> {
  const raw = parseBearer(request);
  if (!raw?.startsWith("sk-neo-acct-")) {
    throw new PlatformAuthError("authentication_required", "Invalid or missing account API key.");
  }

  const result = await getAccountTokenByHash(hashToken(raw));
  if (!result) {
    throw new PlatformAuthError("authentication_required", "Invalid or missing account API key.");
  }

  const { token, org } = result;
  const scopes = token.scopes ?? ["read", "write"];

  if (opts.scope && !hasScope(scopes, opts.scope)) {
    throw new PlatformAuthError("forbidden", `Missing '${opts.scope}' scope.`);
  }

  touchAccountTokenLastUsed(token.id).catch(() => {});

  const workspaceSlug = request.headers.get("X-Neo-Workspace");
  let workspace: Workspace | null = null;
  if (workspaceSlug) {
    workspace = await getPlatformWorkspaceBySlug(org.id, workspaceSlug);
    if (!workspace) {
      throw new PlatformAuthError("not_found", `Workspace '${workspaceSlug}' not found.`);
    }
  } else if (opts.requireWorkspace) {
    throw new PlatformAuthError("workspace_required", "X-Neo-Workspace header is required.");
  }

  const tenantIdHeader = request.headers.get("X-Neo-Tenant-Id");
  let tenant: Tenant | null = null;
  if (tenantIdHeader) {
    tenant = await getTenantByExternalIdOrSlug(org.id, tenantIdHeader);
    if (!tenant) {
      throw new PlatformAuthError("not_found", `Tenant '${tenantIdHeader}' not found.`);
    }
  } else if (opts.requireTenant) {
    throw new PlatformAuthError("tenant_required", "X-Neo-Tenant-Id header is required.");
  }

  return { org, token, workspace, tenant, scopes };
}

export class PlatformAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public param?: string
  ) {
    super(message);
    this.name = "PlatformAuthError";
  }
}

export function handlePlatformAuthError(err: unknown, requestId: string) {
  if (err instanceof PlatformAuthError) {
    const status =
      err.code === "authentication_required"
        ? 401
        : err.code === "forbidden"
          ? 403
          : err.code === "not_found"
            ? 404
            : 400;
    return apiError(err.code, err.message, status, err.param, requestId);
  }
  return null;
}
