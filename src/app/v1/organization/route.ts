import { jsonResponse } from "@/lib/api/v1/respond";
import { serializeOrganization } from "@/lib/api/v1/serialize";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { getPlatformOwnerUser } from "@/lib/platform/queries";

export async function GET(request: Request) {
  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const owner = await getPlatformOwnerUser(ctx.org);
    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(
      {
        ...serializeOrganization(ctx.org),
        owner: owner
          ? {
              id: owner.id,
              email: owner.email,
              name: owner.name,
              username: owner.username,
            }
          : null,
      },
      200,
      requestId
    );
  });
}
