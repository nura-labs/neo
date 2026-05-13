import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/api";
import { logActivity, searchNodes } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthenticatedContext(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    if (!query) return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });

    const type = url.searchParams.get("type") ?? undefined;
    const source = url.searchParams.get("source") ?? undefined;
    const tags = url.searchParams.get("tags")?.split(",").filter(Boolean) ?? undefined;

    const nodes = await searchNodes(ctx.workspace.id, query, { type, source, tags });
    logActivity({
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      type: "search",
      via: "web",
      summary: `Searched "${query.slice(0, 80)}"`,
      payload: { query, resultCount: nodes.length, type, source, tags },
    });
    return NextResponse.json({ nodes });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
