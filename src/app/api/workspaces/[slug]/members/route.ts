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

  const members = await listMembers(ctx.workspace.id);
  return NextResponse.json({ members });
}
