import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getPlatformOrgByUserId, revokeAccountToken } from "@/lib/platform/queries";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(request);
    const org = await getPlatformOrgByUserId(user.id);

    if (!org) {
      return NextResponse.json({ error: "Platform not enabled" }, { status: 404 });
    }

    const revoked = await revokeAccountToken(org.id, id);
    if (!revoked) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
