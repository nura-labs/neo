import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import { countOwners, getMembership, removeMembership } from "@/lib/db/queries";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
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

  const { userId } = await params;
  const target = await getMembership(ctx.workspace.id, userId);
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Last-owner guard: must always have at least one owner
  if (target.role === "owner") {
    const owners = await countOwners(ctx.workspace.id);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner" },
        { status: 400 }
      );
    }
  }

  await removeMembership(ctx.workspace.id, userId);
  return NextResponse.json({ success: true });
}
