import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import {
  createMembership,
  getInviteByToken,
  getMembership,
  getWorkspaceById,
  markInviteAccepted,
} from "@/lib/db/queries";
import type { Role } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

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
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 403 });
  }

  const workspace = await getWorkspaceById(invite.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "workspace_missing" }, { status: 410 });
  }

  // Create membership unless already a member (idempotent)
  const existing = await getMembership(workspace.id, user.id);
  if (!existing) {
    await createMembership({
      workspaceId: workspace.id,
      userId: user.id,
      role: invite.role as Role,
    });
  }
  await markInviteAccepted(invite.id, user.id);

  return NextResponse.json({
    workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name },
  });
}
