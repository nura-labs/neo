import { jsonResponse } from "@/lib/api/v1/respond";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { aggregateUsage } from "@/lib/platform/queries";

export async function GET(request: Request) {
  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 365);

    const usage = await aggregateUsage({
      surface: "platform",
      platformOrgId: ctx.org.id,
      workspaceId: ctx.workspace?.id,
      tenantId: ctx.tenant?.id,
      days,
    });

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(
      {
        object: "usage_summary",
        ...usage,
      },
      200,
      requestId
    );
  });
}
