import { jsonResponse } from "@/lib/api/v1/respond";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getGraphData } from "@/lib/db/queries";

export async function GET(request: Request) {
  return withPlatform(
    request,
    { scope: "read", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      const graph = await getGraphData(ctx.workspace!.id);

      logPlatformApiUsage(ctx, "api.request");

      return jsonResponse(
        {
          object: "context_graph",
          ...graph,
        },
        200,
        requestId
      );
    }
  );
}
