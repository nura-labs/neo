import { NextResponse } from "next/server";
import { aggregateUsage } from "@/lib/platform/queries";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";

export async function GET(request: Request) {
  try {
    const { org } = await getWorkspacePlatformContext(request);

    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 365);

    const usage = await aggregateUsage({
      surface: "platform",
      platformOrgId: org.id,
      days,
    });

    return NextResponse.json(usage);
  } catch (err) {
    const handled = handleWorkspacePlatformError(err);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
