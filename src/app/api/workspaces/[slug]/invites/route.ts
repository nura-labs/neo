import { NextResponse } from "next/server";
import { getAuthenticatedContext, requireOwner } from "@/lib/auth/api";
import {
  createInvite,
  getMembership,
  getUserByEmail,
  listPendingInvites,
} from "@/lib/db/queries";
import { generateInviteToken } from "@/lib/auth/token";
import { sendEmail } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/templates/invite";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://neo.nura.sh";
const INVITE_TTL_DAYS = 7;

export async function GET(request: Request) {
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

  const invites = await listPendingInvites(ctx.workspace.id);
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
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

  let parsed;
  try {
    parsed = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const email = parsed.email.toLowerCase();

  // Skip if already a member
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    const membership = await getMembership(ctx.workspace.id, existingUser.id);
    if (membership) {
      return NextResponse.json({ error: "already_member" }, { status: 409 });
    }
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);

  const invite = await createInvite({
    workspaceId: ctx.workspace.id,
    email,
    role: parsed.role,
    token,
    expiresAt,
    invitedByUserId: ctx.user.id,
  });

  const acceptUrl = `${APP_URL}/invites/${token}`;
  const tmpl = inviteEmail({
    workspaceName: ctx.workspace.name,
    inviterName: ctx.user.name,
    acceptUrl,
  });
  const sendResult = await sendEmail({
    to: email,
    ...tmpl,
    idempotencyKey: `invite/${invite.id}`,
    tags: [
      { name: "category", value: "invite" },
      { name: "workspace_id", value: ctx.workspace.id },
    ],
  });

  return NextResponse.json(
    {
      invite,
      acceptUrl,
      emailSent: sendResult.ok,
    },
    { status: 201 }
  );
}
