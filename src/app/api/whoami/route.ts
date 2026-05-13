import { NextResponse } from "next/server";
import { getApiTokenByHash, getUserById, touchApiTokenLastUsed } from "@/lib/db/queries";
import { hashToken } from "@/lib/auth/token";

/**
 * Identify the holder of an API token: which workspace it's scoped to and
 * which user created it. Used by the CLI after OAuth and for runtime
 * `neo whoami` checks, where the caller has an API token (workspace-scoped)
 * and not a Firebase ID token (user-scoped). Returns 401 for invalid tokens.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const hash = hashToken(token);
  const result = await getApiTokenByHash(hash);
  if (!result) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  touchApiTokenLastUsed(result.token.id).catch(() => {});

  const user = await getUserById(result.token.createdByUserId);

  return NextResponse.json({
    workspace: {
      id: result.workspace.id,
      slug: result.workspace.slug,
      name: result.workspace.name,
      plan: result.workspace.plan,
    },
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
        }
      : null,
    token: {
      id: result.token.id,
      name: result.token.name,
      tokenPrefix: result.token.tokenPrefix,
      scopes: result.token.scopes,
    },
  });
}
