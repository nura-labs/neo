import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revokeApiToken } from "@/lib/db/queries";

/**
 * Revoke rules:
 *   - workspace owners can revoke any token in the workspace
 *   - members can revoke only the tokens they themselves created
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { id } = await params;

  if (ctx.role !== "owner") {
    const [t] = await db
      .select({ createdByUserId: apiTokens.createdByUserId })
      .from(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (t.createdByUserId !== ctx.user.id) {
      return NextResponse.json({ error: "forbidden_not_creator" }, { status: 403 });
    }
  }

  const ok = await revokeApiToken(ctx.workspace.id, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
