import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import {
  createMembership,
  createWorkspace,
  getWorkspaceBySlug,
  listWorkspacesForUser,
} from "@/lib/db/queries";
import { generateUniqueWorkspaceSlug } from "@/lib/utils/username";
import { z } from "zod";

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
    const user = await getAuthenticatedUser(request);
    const list = await listWorkspacesForUser(user.id);
    return NextResponse.json({
      workspaces: list.map((w) => ({
        id: w.id,
        slug: w.slug,
        name: w.name,
        plan: w.plan,
        scope: w.scope,
        platformEnabled: w.platformOrgId != null,
        role: w.role,
        memberCount: w.memberCount,
      })),
    });
  } catch {
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
    const body = await request.json();
    const input = createSchema.parse(body);

    let slug = input.slug;
    if (slug) {
      const taken = await getWorkspaceBySlug(slug);
      if (taken) {
        return NextResponse.json(
          { error: "Slug already taken" },
          { status: 409 }
        );
      }
    } else {
      slug = await generateUniqueWorkspaceSlug(input.name);
    }

    const workspace = await createWorkspace({
      slug,
      name: input.name,
      createdByUserId: user.id,
    });
    await createMembership({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("create workspace failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
