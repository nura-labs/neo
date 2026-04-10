import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { searchNodes } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
    }

    const type = url.searchParams.get("type") ?? undefined;
    const source = url.searchParams.get("source") ?? undefined;
    const tags = url.searchParams.get("tags")?.split(",").filter(Boolean) ?? undefined;

    const nodes = await searchNodes(user.id, query, { type, source, tags });
    return NextResponse.json({ nodes });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
