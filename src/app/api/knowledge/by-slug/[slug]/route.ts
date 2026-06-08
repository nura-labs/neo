import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { getNodeBySlug } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext(request);
    const { slug } = await params;
    const node = await getNodeBySlug(slug, ctx.workspace.id);
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(node);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
