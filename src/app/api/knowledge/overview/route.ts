import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getOverview } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const overview = await getOverview(user.id);
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
