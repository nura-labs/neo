import { NextResponse } from "next/server";
import {
  getWorkspacePlatformStatus,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";

export async function GET(request: Request) {
  try {
    const { enabled, org, workspace } = await getWorkspacePlatformStatus(request);

    if (!enabled || !org) {
      return NextResponse.json({
        enabled: false,
        organization: null,
        workspace_id: workspace.id,
      });
    }

    return NextResponse.json({
      enabled: true,
      workspace_id: workspace.id,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        enabled_at: org.enabledAt,
        created_at: org.createdAt,
        updated_at: org.updatedAt,
      },
    });
  } catch (err) {
    const handled = handleWorkspacePlatformError(err);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
