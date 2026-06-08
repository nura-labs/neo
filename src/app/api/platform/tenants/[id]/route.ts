import { NextResponse } from "next/server";
import { getTenantById } from "@/lib/platform/queries";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await getWorkspacePlatformContext(request);

    const tenant = await getTenantById(org.id, id);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: tenant.id,
      external_id: tenant.externalId,
      slug: tenant.slug,
      name: tenant.name,
      metadata: tenant.metadata ?? {},
      created_at: tenant.createdAt,
      updated_at: tenant.updatedAt,
    });
  } catch (err) {
    const handled = handleWorkspacePlatformError(err);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
