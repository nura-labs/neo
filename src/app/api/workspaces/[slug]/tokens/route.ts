import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import {
  createApiToken,
  listApiTokens,
  listApiTokensCreatedBy,
} from "@/lib/db/queries";
import { generateApiToken } from "@/lib/auth/token";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

/**
 * Token visibility:
 *   - workspace owners see all tokens
 *   - members see only the tokens they themselves created
 *
 * This mirrors GitHub's PAT model — anyone with access to the repo can mint
 * their own token, but they can't see or revoke other people's tokens.
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const tokens =
    ctx.role === "owner"
      ? await listApiTokens(ctx.workspace.id)
      : await listApiTokensCreatedBy(ctx.workspace.id, ctx.user.id);

  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      scopes: t.scopes,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      revokedAt: t.revokedAt,
      createdByUserId: t.createdByUserId,
      mine: t.createdByUserId === ctx.user.id,
    })),
  });
}

/**
 * Any member of the workspace can mint a token for themselves. The token
 * carries the same scopes the member has via membership (default
 * ["read","write"]). Owner role is NOT required.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
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

  return NextResponse.json(
    {
      token: { ...token, tokenHash: undefined },
      plaintext: generated.plaintext,
    },
    { status: 201 }
  );
}
