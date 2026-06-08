import { z } from "zod";
import { badRequest, jsonResponse, listResponse } from "@/lib/api/v1/respond";
import { serializeWorkspace } from "@/lib/api/v1/serialize";
import { createWorkspaceSchema } from "@/lib/api/v1/validators";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getWorkspaceBySlug } from "@/lib/db/queries";
import {
  createPlatformWorkspace,
  listPlatformWorkspaces,
} from "@/lib/platform/queries";
import { generateUniqueWorkspaceSlug } from "@/lib/utils/username";

export async function GET(request: Request) {
  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const workspaces = await listPlatformWorkspaces(ctx.org.id);
    logPlatformApiUsage(ctx, "api.request");

    return listResponse(
      workspaces.map(serializeWorkspace),
      { has_more: false },
      requestId
    );
  });
}

export async function POST(request: Request) {
  return withPlatform(request, { scope: "write" }, async (ctx, requestId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body.", undefined, requestId);
    }

    let input: z.infer<typeof createWorkspaceSchema>;
    try {
      input = createWorkspaceSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
      }
      throw err;
    }

    let slug = input.slug;
    if (slug) {
      const taken = await getWorkspaceBySlug(slug);
      if (taken) {
        return badRequest("Workspace slug already taken.", "slug", requestId);
      }
    } else {
      slug = await generateUniqueWorkspaceSlug(input.name);
    }

    const workspace = await createPlatformWorkspace({
      platformOrgId: ctx.org.id,
      createdByUserId: ctx.org.userId,
      name: input.name,
      slug,
    });

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(serializeWorkspace(workspace), 201, requestId);
  });
}
