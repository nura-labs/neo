import { NextResponse } from "next/server";
import {
  getInviteByToken,
  getUserById,
  getWorkspaceById,
} from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "already_accepted" }, { status: 410 });
  }
  if (new Date() > invite.expiresAt) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const [workspace, inviter] = await Promise.all([
    getWorkspaceById(invite.workspaceId),
    getUserById(invite.invitedByUserId),
  ]);

  return NextResponse.json({
    workspace: workspace
      ? { name: workspace.name, slug: workspace.slug }
      : null,
    inviter: inviter ? { name: inviter.name } : null,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
}
