import { jsonResponse, notFound } from "@/lib/api/v1/respond";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { aggregateUsage, getTenantById } from "@/lib/platform/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant_id: string }> }
) {
  const { tenant_id } = await params;

  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const tenant = await getTenantById(ctx.org.id, tenant_id);
    if (!tenant) return notFound("Tenant", requestId);

    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 365);

    const usage = await aggregateUsage({
      surface: "platform",
      platformOrgId: ctx.org.id,
      tenantId: tenant.id,
      workspaceId: ctx.workspace?.id,
      days,
    });

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(
      {
        object: "usage_summary",
        tenant: {
          id: tenant.id,
          external_id: tenant.externalId,
          name: tenant.name,
        },
        ...usage,
      },
      200,
      requestId
    );
  });
}
