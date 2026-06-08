import { jsonResponse } from "@/lib/api/v1/respond";
import { serializeNode } from "@/lib/api/v1/serialize";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getOverview } from "@/lib/db/queries";

export async function GET(request: Request) {
  return withPlatform(
    request,
    { scope: "read", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      const url = new URL(request.url);
      const source = url.searchParams.get("source") ?? undefined;

      const overview = await getOverview(ctx.workspace!.id, {
        source,
        tenantId: ctx.tenant!.id,
      });

      logPlatformApiUsage(ctx, "overview.read");

      return jsonResponse(
        {
          object: "context_overview",
          total_nodes: overview.totalNodes,
          total_edges: overview.totalEdges,
          type_breakdown: overview.typeBreakdown,
          source_breakdown: overview.sourceBreakdown,
          recent_nodes: overview.recentNodes.map(serializeNode),
        },
        200,
        requestId
      );
    }
  );
}
