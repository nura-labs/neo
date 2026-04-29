import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getGraphData } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const graphData = await getGraphData(user.id);
    return NextResponse.json(graphData);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
