import { NextResponse } from "next/server";
import { z } from "zod";
import {
  enablePlatformForWorkspace,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";
import { generateSlug } from "@/lib/utils/slugify";
import { getAuthenticatedUser } from "@/lib/auth/api";

const enableSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export async function POST(request: Request) {
  try {
    await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine
    }

    const input = enableSchema.parse(body);
    const name = input.name;
    const slug = input.slug ?? (name ? generateSlug(name) : undefined);

    const { org, workspace, created } = await enablePlatformForWorkspace(request, {
      name,
      slug,
    });

    return NextResponse.json(
      {
        enabled: true,
        workspace_id: workspace.id,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          enabled_at: org.enabledAt,
        },
      },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    const handled = handleWorkspacePlatformError(error);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Only workspace owners can enable Platform" }, { status: 403 });
    }
    console.error("enable platform failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
