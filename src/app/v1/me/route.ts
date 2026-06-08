import { jsonResponse } from "@/lib/api/v1/respond";
import { serializeOrganization, serializeTenant, serializeWorkspace } from "@/lib/api/v1/serialize";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getPlatformOwnerUser } from "@/lib/platform/queries";

export async function GET(request: Request) {
  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const owner = await getPlatformOwnerUser(ctx.org);
    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(
      {
        object: "account",
        id: ctx.org.id,
        name: ctx.org.name,
        slug: ctx.org.slug,
        plan: ctx.org.plan,
        enabled_at: ctx.org.enabledAt.toISOString(),
        organization: serializeOrganization(ctx.org),
        owner: owner
          ? {
              id: owner.id,
              email: owner.email,
              name: owner.name,
              username: owner.username,
            }
          : null,
        active_workspace: ctx.workspace ? serializeWorkspace(ctx.workspace) : null,
        active_tenant: ctx.tenant ? serializeTenant(ctx.tenant) : null,
        scopes: ctx.scopes,
      },
      200,
      requestId
    );
  });
}
