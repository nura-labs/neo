import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { regenerateApiToken } from "@/lib/db/queries";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    return NextResponse.json({ apiToken: user.apiToken });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    const newToken = await regenerateApiToken(user.id);
    return NextResponse.json({ apiToken: newToken });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
