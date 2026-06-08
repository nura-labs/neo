import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { aggregateUsage, getPlatformOrgByUserId } from "@/lib/platform/queries";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const org = await getPlatformOrgByUserId(user.id);

    if (!org) {
      return NextResponse.json({ error: "Platform not enabled" }, { status: 404 });
    }

    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 365);

    const usage = await aggregateUsage({
      surface: "platform",
      platformOrgId: org.id,
      days,
    });

    return NextResponse.json(usage);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
