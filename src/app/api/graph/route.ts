import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { getGraphData } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthenticatedContext(request);
    const graphData = await getGraphData(ctx.workspace.id);
    return NextResponse.json(graphData);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
