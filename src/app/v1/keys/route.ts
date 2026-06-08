import { z } from "zod";
import { badRequest, jsonResponse, listResponse } from "@/lib/api/v1/respond";
import { serializeAccountKey } from "@/lib/api/v1/serialize";
import { createKeySchema } from "@/lib/api/v1/validators";
import { logPlatformApiUsage, withPlatform } from "@/lib/api/v1/with-platform";
import { createAccountToken, listAccountTokens } from "@/lib/platform/queries";

export async function GET(request: Request) {
  return withPlatform(request, { scope: "read" }, async (ctx, requestId) => {
    const tokens = await listAccountTokens(ctx.org.id);
    logPlatformApiUsage(ctx, "api.request");

    return listResponse(
      tokens.map(serializeAccountKey),
      { has_more: false },
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

    let input: z.infer<typeof createKeySchema>;
    try {
      input = createKeySchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return badRequest(err.issues[0]?.message ?? "Invalid input.", undefined, requestId);
      }
      throw err;
    }

    const { token, plaintext } = await createAccountToken({
      platformOrgId: ctx.org.id,
      createdByUserId: ctx.org.userId,
      name: input.name,
      scopes: input.scopes,
    });

    logPlatformApiUsage(ctx, "api.request");

    return jsonResponse(
      {
        ...serializeAccountKey(token),
        secret: plaintext,
      },
      201,
      requestId
    );
  });
}
