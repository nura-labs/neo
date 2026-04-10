import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { getNodeById, updateNode, deleteNode } from "@/lib/db/queries";
import { updateNodeSchema } from "@/lib/validators/knowledge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = await params;
    const node = await getNodeById(id, user.id);

    if (!node) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(node);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = await params;
    const body = await request.json();
    const input = updateNodeSchema.parse(body);
    const node = await updateNode(id, user.id, input);

    if (!node) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(node);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = await params;
    const deleted = await deleteNode(id, user.id);

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
