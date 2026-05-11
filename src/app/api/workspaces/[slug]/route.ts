import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import { deleteWorkspace, updateWorkspace } from "@/lib/db/queries";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await getAuthenticatedContext(request);
    return NextResponse.json({
      workspace: ctx.workspace,
      role: ctx.role,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 401 }
    );
  }
}

export async function PATCH(request: Request) {
  let ctx;
  try {
    ctx = await getAuthenticatedContext(request);
    requireOwner(ctx);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const input = patchSchema.parse(body);
    const updated = await updateWorkspace(ctx.workspace.id, input);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthenticatedContext(request);
    requireOwner(ctx);
    await deleteWorkspace(ctx.workspace.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 403 }
    );
  }
}
