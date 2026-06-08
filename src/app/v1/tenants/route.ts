import { z } from "zod";
import { badRequest, decodeCursor, encodeCursor, jsonResponse, listResponse } from "@/lib/api/v1/respond";
import { serializeTenant } from "@/lib/api/v1/serialize";
import { createTenantSchema } from "@/lib/api/v1/validators";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { createTenant, listTenants } from "@/lib/platform/queries";

export async function GET(request: Request) {
  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);
    const startingAfter = decodeCursor(url.searchParams.get("starting_after"));

    let offset = 0;
    if (startingAfter) {
      const { tenants: all } = await listTenants(ctx.org.id, { limit: 1000, offset: 0 });
      const idx = all.findIndex((t) => t.id === startingAfter);
      if (idx >= 0) offset = idx + 1;
    }

    const { tenants, total } = await listTenants(ctx.org.id, { limit, offset });
    const hasMore = offset + tenants.length < total;
    const nextCursor =
      hasMore && tenants.length > 0 ? encodeCursor(tenants[tenants.length - 1].id) : null;

    logPlatformApiUsage(ctx, "api.request");

    return listResponse(
      tenants.map(serializeTenant),
      { has_more: hasMore, next_cursor: nextCursor },
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

    let input: z.infer<typeof createTenantSchema>;
    try {
      input = createTenantSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
      }
      throw err;
    }

    const tenant = await createTenant({
      platformOrgId: ctx.org.id,
      externalId: input.external_id,
      name: input.name,
      slug: input.slug,
      metadata: input.metadata,
    });

    logPlatformApiUsage(ctx, "tenant.create");

    return jsonResponse(serializeTenant(tenant), 201, requestId);
  });
}
