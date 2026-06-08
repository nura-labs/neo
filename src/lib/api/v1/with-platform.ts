import { randomUUID } from "crypto";
import {
  getPlatformContext,
  handlePlatformAuthError,
  type PlatformContext,
} from "@/lib/platform/auth";
import { apiError } from "@/lib/api/v1/respond";
import { logUsage } from "@/lib/usage/log";

export async function withPlatform(
  request: Request,
  opts: {
    requireWorkspace?: boolean;
    requireTenant?: boolean;
    scope?: "read" | "write" | "admin";
  },
  handler: (ctx: PlatformContext, requestId: string) => Promise<Response>
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const ctx = await getPlatformContext(request, opts);
    return await handler(ctx, requestId);
  } catch (err) {
    const authResp = handlePlatformAuthError(err, requestId);
    if (authResp) return authResp;
    console.error(err);
    return apiError("internal_error", "Internal server error", 500, undefined, requestId);
  }
}

export function logPlatformApiUsage(
  ctx: PlatformContext,
  operation: string,
  units?: number
): void {
  logUsage({
    surface: "platform",
    via: "api",
    operation,
    platformOrgId: ctx.org.id,
    workspaceId: ctx.workspace?.id ?? null,
    tenantId: ctx.tenant?.id ?? null,
    units,
  });
}
