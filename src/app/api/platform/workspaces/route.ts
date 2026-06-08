import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/db/queries";
import { createPlatformWorkspace, listPlatformWorkspaces } from "@/lib/platform/queries";
import { generateSlug } from "@/lib/utils/slugify";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";
import { getAuthenticatedUser } from "@/lib/auth/api";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export async function GET(request: Request) {
  try {
    const { org } = await getWorkspacePlatformContext(request);
    const workspaces = await listPlatformWorkspaces(org.id);

    return NextResponse.json({
      workspaces: workspaces.map((ws) => ({
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        plan: ws.plan,
        scope: ws.scope,
        created_at: ws.createdAt,
        updated_at: ws.updatedAt,
      })),
    });
  } catch (err) {
    const handled = handleWorkspacePlatformError(err);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { org } = await getWorkspacePlatformContext(request);
    const body = await request.json();
    const input = createSchema.parse(body);

    let slug = input.slug ?? generateSlug(input.name);
    if (!slug) slug = "workspace";

    const taken = await getWorkspaceBySlug(slug);
    if (taken) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const workspace = await createPlatformWorkspace({
      platformOrgId: org.id,
      createdByUserId: user.id,
      name: input.name,
      slug,
    });

    return NextResponse.json(
      {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        plan: workspace.plan,
        scope: workspace.scope,
        created_at: workspace.createdAt,
        updated_at: workspace.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    const handled = handleWorkspacePlatformError(error);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("create platform workspace failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
