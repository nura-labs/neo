import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { getOverview } from "@/lib/db/queries";

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
  } catch (err) {
    console.error("auth failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const overview = await getOverview(ctx.workspace.id);
    return NextResponse.json(overview);
  } catch (err) {
    console.error("overview query failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
