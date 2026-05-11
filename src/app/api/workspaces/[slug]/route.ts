import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import {
  deleteWorkspace,
  getWorkspaceBySlug,
  updateWorkspace,
} from "@/lib/db/queries";
import { isReservedName } from "@/lib/utils/username";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
      message: "Lowercase letters, numbers, and dashes only (no leading/trailing dashes)",
    })
    .optional(),
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

  let input;
  try {
    input = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (input.slug && input.slug !== ctx.workspace.slug) {
    if (isReservedName(input.slug)) {
      return NextResponse.json(
        { error: "Slug is reserved" },
        { status: 400 }
      );
    }
    const conflict = await getWorkspaceBySlug(input.slug);
    if (conflict && conflict.id !== ctx.workspace.id) {
      return NextResponse.json(
        { error: "Slug already taken" },
        { status: 409 }
      );
    }
  }

  const updated = await updateWorkspace(ctx.workspace.id, input);
  return NextResponse.json(updated);
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
