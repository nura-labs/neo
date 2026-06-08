import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import {
  countOwners,
  getMembership,
  removeMembership,
  updateMembershipRole,
} from "@/lib/db/queries";
import { z } from "zod";

const patchSchema = z.object({
  role: z.enum(["owner", "member"]),
});

export async function PATCH(
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

  let input;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { userId } = await params;
  const target = await getMembership(ctx.workspace.id, userId);
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (target.role === input.role) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  // Last-owner guard: demoting the only owner would leave the workspace
  // ownerless.
  if (target.role === "owner" && input.role !== "owner") {
    const owners = await countOwners(ctx.workspace.id);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the last owner" },
        { status: 400 }
      );
    }
  }

  await updateMembershipRole(ctx.workspace.id, userId, input.role);
  return NextResponse.json({ success: true });
}

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
