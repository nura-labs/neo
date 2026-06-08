import { jsonResponse, notFound } from "@/lib/api/v1/respond";
import { serializeNode } from "@/lib/api/v1/serialize";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getNodeBySlug } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  return withPlatform(
    request,
    { scope: "read", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      const node = await getNodeBySlug(slug, ctx.workspace!.id, ctx.tenant!.id);
      if (!node) return notFound("Context node", requestId);

      logPlatformApiUsage(ctx, "node.read");

      return jsonResponse(serializeNode(node), 200, requestId);
    }
  );
}
