import { NextResponse } from "next/server";
import { z } from "zod";
import { createTenantSchema } from "@/lib/api/v1/validators";
import { createTenant, listTenants } from "@/lib/platform/queries";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";

export async function GET(request: Request) {
  try {
    const { org } = await getWorkspacePlatformContext(request);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

    const { tenants, total } = await listTenants(org.id, { limit, offset });

    return NextResponse.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        external_id: t.externalId,
        slug: t.slug,
        name: t.name,
        metadata: t.metadata ?? {},
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
      total,
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
  try {
    const { org } = await getWorkspacePlatformContext(request);
    const body = await request.json();
    const input = createTenantSchema.parse(body);

    const tenant = await createTenant({
      platformOrgId: org.id,
      externalId: input.external_id,
      name: input.name,
      slug: input.slug,
      metadata: input.metadata,
    });

    return NextResponse.json(
      {
        id: tenant.id,
        external_id: tenant.externalId,
        slug: tenant.slug,
        name: tenant.name,
        metadata: tenant.metadata ?? {},
        created_at: tenant.createdAt,
        updated_at: tenant.updatedAt,
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
    console.error("create tenant failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
