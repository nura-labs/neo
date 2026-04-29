import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getRelatedNodes } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { id } = await params;

    const url = new URL(request.url);
    const relationship = url.searchParams.get("relationship") ?? undefined;

    const related = await getRelatedNodes(id, user.id, { relationship });

    return NextResponse.json(
      related.map((r) => ({
        id: r.node.id,
        title: r.node.title,
        slug: r.node.slug,
        type: r.node.type,
        relationship: r.edge.relationship,
        direction: r.direction,
        weight: r.edge.weight,
      }))
    );
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
