import { NextResponse } from "next/server";
import { z } from "zod";
import { createKeySchema } from "@/lib/api/v1/validators";
import { createAccountToken, listAccountTokens } from "@/lib/platform/queries";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";
import { getAuthenticatedUser } from "@/lib/auth/api";

export async function GET(request: Request) {
  try {
    const { org } = await getWorkspacePlatformContext(request);
    const tokens = await listAccountTokens(org.id);

    return NextResponse.json({
      keys: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        token_prefix: t.tokenPrefix,
        scopes: t.scopes,
        last_used_at: t.lastUsedAt,
        created_at: t.createdAt,
      })),
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
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { org } = await getWorkspacePlatformContext(request);
    const body = await request.json();
    const input = createKeySchema.parse(body);

    const { token, plaintext } = await createAccountToken({
      platformOrgId: org.id,
      createdByUserId: user.id,
      name: input.name,
      scopes: input.scopes,
    });

    return NextResponse.json(
      {
        id: token.id,
        name: token.name,
        token_prefix: token.tokenPrefix,
        scopes: token.scopes,
        secret: plaintext,
        created_at: token.createdAt,
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
    console.error("create key failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
