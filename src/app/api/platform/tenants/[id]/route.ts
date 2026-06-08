import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getPlatformOrgByUserId, getTenantById } from "@/lib/platform/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(request);
    const org = await getPlatformOrgByUserId(user.id);

    if (!org) {
      return NextResponse.json({ error: "Platform not enabled" }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
