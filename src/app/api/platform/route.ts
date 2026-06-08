import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getPlatformOrgByUserId } from "@/lib/platform/queries";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const org = await getPlatformOrgByUserId(user.id);

    if (!org) {
      return NextResponse.json({
        enabled: false,
        organization: null,
      });
    }

    return NextResponse.json({
      enabled: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        enabled_at: org.enabledAt,
        created_at: org.createdAt,
        updated_at: org.updatedAt,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
