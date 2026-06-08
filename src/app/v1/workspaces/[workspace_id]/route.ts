import { z } from "zod";
import { badRequest, jsonResponse, notFound } from "@/lib/api/v1/respond";
import { serializeWorkspace } from "@/lib/api/v1/serialize";
import { updateWorkspaceSchema } from "@/lib/api/v1/validators";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { deleteWorkspace, getWorkspaceBySlug, updateWorkspace } from "@/lib/db/queries";
import { getPlatformWorkspace } from "@/lib/platform/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspace_id: string }> }
) {
  const { workspace_id } = await params;

  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const workspace = await getPlatformWorkspace(ctx.org.id, workspace_id);
    if (!workspace) return notFound("Workspace", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(serializeWorkspace(workspace), 200, requestId);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspace_id: string }> }
) {
  const { workspace_id } = await params;

  return withPlatform(request, { scope: "write" }, async (ctx, requestId) => {
    const workspace = await getPlatformWorkspace(ctx.org.id, workspace_id);
    if (!workspace) return notFound("Workspace", requestId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body.", undefined, requestId);
    }

    let input: z.infer<typeof updateWorkspaceSchema>;
    try {
      input = updateWorkspaceSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
      }
      throw err;
    }

    if (input.slug && input.slug !== workspace.slug) {
      const taken = await getWorkspaceBySlug(input.slug);
      if (taken && taken.id !== workspace.id) {
        return badRequest("Workspace slug already taken.", "slug", requestId);
      }
    }

    const updated = await updateWorkspace(workspace.id, input);
    if (!updated) return notFound("Workspace", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(serializeWorkspace(updated), 200, requestId);
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspace_id: string }> }
) {
  const { workspace_id } = await params;

  return withPlatform(request, { scope: "write" }, async (ctx, requestId) => {
    const workspace = await getPlatformWorkspace(ctx.org.id, workspace_id);
    if (!workspace) return notFound("Workspace", requestId);

    const deleted = await deleteWorkspace(workspace.id);
    if (!deleted) return notFound("Workspace", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse({ object: "workspace", id: workspace_id, deleted: true }, 200, requestId);
  });
}
