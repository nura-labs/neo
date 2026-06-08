import { z } from "zod";
import { badRequest, decodeCursor, encodeCursor, jsonResponse, listResponse } from "@/lib/api/v1/respond";
import { serializeNode } from "@/lib/api/v1/serialize";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { createNode, getNodesByWorkspace } from "@/lib/db/queries";
import { createNodeSchema } from "@/lib/validators/knowledge";

export async function GET(request: Request) {
  return withPlatform(
    request,
    { scope: "read", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);
      const startingAfter = decodeCursor(url.searchParams.get("starting_after"));
      const type = url.searchParams.get("type") ?? undefined;
      const source = url.searchParams.get("source") ?? undefined;
      const tags = url.searchParams.get("tags")?.split(",").filter(Boolean);

      let page = 1;
      if (startingAfter) {
        const { nodes: all } = await getNodesByWorkspace(ctx.workspace!.id, {
          tenantId: ctx.tenant!.id,
          limit: 1000,
          page: 1,
          type,
          source,
          tags,
        });
        const idx = all.findIndex((n) => n.id === startingAfter);
        if (idx >= 0) page = Math.floor(idx / limit) + 2;
      }

      const { nodes, total } = await getNodesByWorkspace(ctx.workspace!.id, {
        tenantId: ctx.tenant!.id,
        limit,
        page,
        type,
        source,
        tags,
      });

      const offset = (page - 1) * limit;
      const hasMore = offset + nodes.length < total;
      const nextCursor =
        hasMore && nodes.length > 0 ? encodeCursor(nodes[nodes.length - 1].id) : null;

      logPlatformApiUsage(ctx, "node.read");

      return listResponse(
        nodes.map(serializeNode),
        { has_more: hasMore, next_cursor: nextCursor },
        requestId
      );
    }
  );
}

export async function POST(request: Request) {
  return withPlatform(
    request,
    { scope: "write", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return badRequest("Invalid JSON body.", undefined, requestId);
      }

      let input: z.infer<typeof createNodeSchema>;
      try {
        input = createNodeSchema.parse(body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
        }
        throw err;
      }

      const node = await createNode(
        ctx.workspace!.id,
        ctx.org.userId,
        input,
        "api",
        ctx.tenant!.id
      );

      logPlatformApiUsage(ctx, "node.create");

      return jsonResponse(serializeNode(node), 201, requestId);
    }
  );
}
