import { jsonResponse, notFound } from "@/lib/api/v1/respond";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getNodeById, getRelatedNodes } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ node_id: string }> }
) {
  const { node_id } = await params;

  return withPlatform(
    request,
    { scope: "read", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      const node = await getNodeById(node_id, ctx.workspace!.id, ctx.tenant!.id);
      if (!node) return notFound("Context node", requestId);

      const url = new URL(request.url);
      const relationship = url.searchParams.get("relationship") ?? undefined;

      const related = await getRelatedNodes(node_id, ctx.workspace!.id, { relationship });

      logPlatformApiUsage(ctx, "related.read");

      return jsonResponse(
        {
          object: "list",
          data: related.map((r) => ({
            object: "related_node",
            id: r.node.id,
            title: r.node.title,
            slug: r.node.slug,
            type: r.node.type,
            relationship: r.edge.relationship,
            direction: r.direction,
            weight: r.edge.weight,
          })),
          has_more: false,
          next_cursor: null,
        },
        200,
        requestId
      );
    }
  );
}
