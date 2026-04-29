import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getNodeBySlug } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { slug } = await params;
    const node = await getNodeBySlug(slug, user.id);
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(node);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
