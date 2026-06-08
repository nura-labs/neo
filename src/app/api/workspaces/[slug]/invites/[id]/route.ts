import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import { revokeInvite } from "@/lib/db/queries";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const ok = await revokeInvite(ctx.workspace.id, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
