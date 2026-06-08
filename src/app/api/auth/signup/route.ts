import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/firebase-admin";
import {
  createMembership,
  createUser,
  createWorkspace,
  getUserByFirebaseUid,
  getUserByUsername,
} from "@/lib/db/queries";
import {
  generateUniqueWorkspaceSlug,
  isReservedName,
  isValidUsernameFormat,
} from "@/lib/utils/username";
import { z } from "zod";

const schema = z.object({
  idToken: z.string().min(10),
  username: z.string().min(2).max(40),
});

export async function POST(request: Request) {
  let parsed;
  try {
    const body = await request.json();
    parsed = schema.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { idToken, username } = parsed;
  const normalized = username.toLowerCase();

  if (!isValidUsernameFormat(normalized)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  if (isReservedName(normalized)) {
    return NextResponse.json({ error: "reserved_username" }, { status: 400 });
  }
  if (await getUserByUsername(normalized)) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const existing = await getUserByFirebaseUid(decoded.uid);
  if (existing) {
    return NextResponse.json({ user: existing });
  }

  const user = await createUser({
    email: decoded.email ?? "",
    name: decoded.name ?? decoded.email ?? "User",
    username: normalized,
    firebaseUid: decoded.uid,
  });

  const slug = await generateUniqueWorkspaceSlug(`${normalized}-personal`);
  const workspace = await createWorkspace({
    slug,
    name: `${user.name}'s workspace`,
    createdByUserId: user.id,
  });
  await createMembership({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return NextResponse.json({ user, workspace }, { status: 201 });
}
