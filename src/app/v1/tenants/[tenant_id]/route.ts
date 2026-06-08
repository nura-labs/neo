import { z } from "zod";
import { badRequest, jsonResponse, notFound } from "@/lib/api/v1/respond";
import { serializeTenant } from "@/lib/api/v1/serialize";
import { updateTenantSchema } from "@/lib/api/v1/validators";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { deleteTenant, getTenantById, updateTenant } from "@/lib/platform/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant_id: string }> }
) {
  const { tenant_id } = await params;

  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const tenant = await getTenantById(ctx.org.id, tenant_id);
    if (!tenant) return notFound("Tenant", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(serializeTenant(tenant), 200, requestId);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenant_id: string }> }
) {
  const { tenant_id } = await params;

  return withPlatform(request, { scope: "write" }, async (ctx, requestId) => {
    const tenant = await getTenantById(ctx.org.id, tenant_id);
    if (!tenant) return notFound("Tenant", requestId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body.", undefined, requestId);
    }

    let input: z.infer<typeof updateTenantSchema>;
    try {
      input = updateTenantSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
      }
      throw err;
    }

    const updated = await updateTenant(ctx.org.id, tenant_id, input);
    if (!updated) return notFound("Tenant", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(serializeTenant(updated), 200, requestId);
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenant_id: string }> }
) {
  const { tenant_id } = await params;

  return withPlatform(request, { scope: "write" }, async (ctx, requestId) => {
    const tenant = await getTenantById(ctx.org.id, tenant_id);
    if (!tenant) return notFound("Tenant", requestId);

    const deleted = await deleteTenant(ctx.org.id, tenant_id);
    if (!deleted) return notFound("Tenant", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse({ object: "tenant", id: tenant_id, deleted: true }, 200, requestId);
  });
}
