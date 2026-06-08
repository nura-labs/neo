import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { aggregateUsage } from "@/lib/platform/queries";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    let workspaceId: string | undefined;

    try {
      const ctx = await getAuthenticatedContext(request);
      workspaceId = ctx.workspace.id;
    } catch {
      // workspace context is optional for personal usage
    }

    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 365);

    const usage = await aggregateUsage({
      surface: "personal",
      workspaceId,
      days,
    });

    return NextResponse.json({
      user_id: user.id,
      ...usage,
    });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
