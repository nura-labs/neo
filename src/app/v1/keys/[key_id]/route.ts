import { jsonResponse, notFound } from "@/lib/api/v1/respond";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { revokeAccountToken } from "@/lib/platform/queries";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ key_id: string }> }
) {
  const { key_id } = await params;

  return withPlatform(request, { scope: "write" }, async (ctx, requestId) => {
    const revoked = await revokeAccountToken(ctx.org.id, key_id);
    if (!revoked) return notFound("Account API key", requestId);

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse({ object: "account_api_key", id: key_id, deleted: true }, 200, requestId);
  });
}
