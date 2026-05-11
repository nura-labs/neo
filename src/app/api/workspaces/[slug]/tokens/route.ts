import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import { createApiToken, listApiTokens } from "@/lib/db/queries";
import { generateApiToken } from "@/lib/auth/token";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const tokens = await listApiTokens(ctx.workspace.id);
  // Strip the hash before returning to the client
  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      scopes: t.scopes,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      revokedAt: t.revokedAt,
    })),
  });
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
    requireOwner(ctx);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 403 }
    );
  }

  let parsed;
  try {
    parsed = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const generated = generateApiToken(ctx.workspace.slug);
  const token = await createApiToken({
    workspaceId: ctx.workspace.id,
    createdByUserId: ctx.user.id,
    name: parsed.name,
    tokenPrefix: generated.prefix,
    tokenHash: generated.hash,
    scopes: ["read", "write"],
  });

  // Plaintext is shown ONCE — frontend must surface a copy-now warning.
  return NextResponse.json(
    {
      token: { ...token, tokenHash: undefined },
      plaintext: generated.plaintext,
    },
    { status: 201 }
  );
}
