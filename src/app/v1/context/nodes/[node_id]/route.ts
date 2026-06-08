import { z } from "zod";
import { badRequest, jsonResponse, notFound } from "@/lib/api/v1/respond";
import { serializeNode } from "@/lib/api/v1/serialize";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { deleteNode, getNodeById, updateNode } from "@/lib/db/queries";
import { updateNodeSchema } from "@/lib/validators/knowledge";

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

      logPlatformApiUsage(ctx, "node.read");

      return jsonResponse(serializeNode(node), 200, requestId);
    }
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ node_id: string }> }
) {
  const { node_id } = await params;

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

      let input: z.infer<typeof updateNodeSchema>;
      try {
        input = updateNodeSchema.parse(body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
        }
        throw err;
      }

      const node = await updateNode(
        node_id,
        ctx.workspace!.id,
        input,
        "api",
        ctx.org.userId,
        ctx.tenant!.id
      );
      if (!node) return notFound("Context node", requestId);

      logPlatformApiUsage(ctx, "node.update");

      return jsonResponse(serializeNode(node), 200, requestId);
    }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ node_id: string }> }
) {
  const { node_id } = await params;

  return withPlatform(
    request,
    { scope: "write", requireWorkspace: true, requireTenant: true },
    async (ctx, requestId) => {
      const deleted = await deleteNode(
        node_id,
        ctx.workspace!.id,
        "api",
        ctx.org.userId,
        ctx.tenant!.id
      );
      if (!deleted) return notFound("Context node", requestId);

      logPlatformApiUsage(ctx, "node.delete");

      return jsonResponse({ object: "context_node", id: node_id, deleted: true }, 200, requestId);
    }
  );
}
