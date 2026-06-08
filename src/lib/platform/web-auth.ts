import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import { getPlatformOrgById, enablePlatformOrg } from "@/lib/platform/queries";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { PlatformOrg, Role, User, Workspace } from "@/lib/db/schema";

export class WorkspacePlatformError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "WorkspacePlatformError";
  }
}

export interface WorkspacePlatformContext {
  user: User;
  workspace: Workspace;
  role: Role;
  org: PlatformOrg;
}

async function resolveAuthenticatedWorkspace(request: Request) {
  try {
    return await getAuthenticatedContext(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    if (message === "Forbidden") {
      throw new WorkspacePlatformError("Forbidden", 403);
    }
    if (message === "No workspace") {
      throw new WorkspacePlatformError("Workspace required", 400);
    }
    throw new WorkspacePlatformError("Not authenticated", 401);
  }
}

/**
 * Resolves platform org from the current workspace (X-Workspace header).
 * Platform is enabled per-workspace via workspaces.platform_org_id.
 */
export async function getWorkspacePlatformContext(
  request: Request
): Promise<WorkspacePlatformContext> {
  const ctx = await resolveAuthenticatedWorkspace(request);

  if (!ctx.workspace.platformOrgId) {
    throw new WorkspacePlatformError("Platform not enabled for this workspace", 404);
  }

  const org = await getPlatformOrgById(ctx.workspace.platformOrgId);
  if (!org) {
    throw new WorkspacePlatformError("Platform not enabled for this workspace", 404);
  }

  return { ...ctx, org };
}

export async function getWorkspacePlatformStatus(request: Request): Promise<{
  user: User;
  workspace: Workspace;
  role: Role;
  enabled: boolean;
  org: PlatformOrg | null;
}> {
  const ctx = await resolveAuthenticatedWorkspace(request);

  if (!ctx.workspace.platformOrgId) {
    return { ...ctx, enabled: false, org: null };
  }

  const org = await getPlatformOrgById(ctx.workspace.platformOrgId);
  if (!org) {
    return { ...ctx, enabled: false, org: null };
  }

  return { ...ctx, enabled: true, org };
}

export async function enablePlatformForWorkspace(
  request: Request,
  opts: { name?: string; slug?: string }
): Promise<{ workspace: Workspace; org: PlatformOrg; created: boolean }> {
  const ctx = await resolveAuthenticatedWorkspace(request);
  requireOwner(ctx);

  if (ctx.workspace.platformOrgId) {
    const existingOrg = await getPlatformOrgById(ctx.workspace.platformOrgId);
    if (existingOrg) {
      return { workspace: ctx.workspace, org: existingOrg, created: false };
    }
  }

  const org = await enablePlatformOrg({
    userId: ctx.user.id,
    name: opts.name ?? `${ctx.user.name}'s organization`,
    slug: opts.slug ?? ctx.workspace.slug,
  });

  const [workspace] = await db
    .update(workspaces)
    .set({ platformOrgId: org.id, updatedAt: new Date() })
    .where(eq(workspaces.id, ctx.workspace.id))
    .returning();

  return { workspace, org, created: true };
}

export function handleWorkspacePlatformError(err: unknown) {
  if (err instanceof WorkspacePlatformError) {
    return { error: err.message, status: err.status };
  }
  return null;
}
