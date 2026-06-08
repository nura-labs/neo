import { NextResponse } from "next/server";
import { revokeAccountToken } from "@/lib/platform/queries";
import {
  getWorkspacePlatformContext,
  handleWorkspacePlatformError,
} from "@/lib/platform/web-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org } = await getWorkspacePlatformContext(request);

    const revoked = await revokeAccountToken(org.id, id);
    if (!revoked) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    const handled = handleWorkspacePlatformError(err);
    if (handled) {
      return NextResponse.json({ error: handled.error }, { status: handled.status });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
