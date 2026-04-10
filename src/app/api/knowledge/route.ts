import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getNodesByUser, createNode } from "@/lib/db/queries";
import { createNodeSchema } from "@/lib/validators/knowledge";

export async function GET(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? undefined;
    const source = url.searchParams.get("source") ?? undefined;
    const tags = url.searchParams.get("tags")?.split(",").filter(Boolean) ?? undefined;
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "50");

    const result = await getNodesByUser(user.id, { type, source, tags, page, limit });
    return NextResponse.json(result);
  } catch (err) {
    console.error("knowledge query failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();
    const input = createNodeSchema.parse(body);
    const node = await createNode(user.id, input);
    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}
