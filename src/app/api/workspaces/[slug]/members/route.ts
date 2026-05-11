import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { listMembers } from "@/lib/db/queries";

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await listMembers(ctx.workspace.id);
  // Flatten so the frontend doesn't have to traverse a nested user object
  const members = rows.map((r) => ({
    userId: r.user.id,
    name: r.user.name,
    email: r.user.email,
    username: r.user.username,
    role: r.role,
    joinedAt: r.joinedAt,
  }));
  return NextResponse.json({ members });
}
