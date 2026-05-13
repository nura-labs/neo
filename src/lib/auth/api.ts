import { adminAuth } from "./firebase-admin";
import {
  createMembership,
  createWorkspace,
  getCliTokenByHash,
  getMembership,
  getUserByFirebaseUid,
  getWorkspaceBySlug,
  listWorkspacesForUser,
  touchCliTokenLastUsed,
} from "@/lib/db/queries";
import { generateUniqueUsername, generateUniqueWorkspaceSlug } from "@/lib/utils/username";
import { createUser } from "@/lib/db/queries";
import { hashToken } from "./token";
import type { User, Workspace, Role } from "@/lib/db/schema";

/**
 * Auto-creates a User record on first login if missing. Used to backfill
 * accounts created via Firebase Auth before they POST /api/auth/signup.
 * The personal workspace is also created on the fly so the rest of the
 * app can rely on every user having at least one workspace.
 */
async function ensureUserAndPersonalWorkspace(
  decoded: { uid: string; email?: string; name?: string }
): Promise<User> {
  let user = await getUserByFirebaseUid(decoded.uid);
  if (user) return user;

  const seed = decoded.email ?? decoded.uid;
  const username = await generateUniqueUsername(seed);
  user = await createUser({
    email: decoded.email ?? "",
    name: decoded.name ?? decoded.email ?? "User",
    username,
    firebaseUid: decoded.uid,
  });

  const slug = await generateUniqueWorkspaceSlug(`${username}-personal`);
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

  return user;
}

/**
 * Resolve the bearer token into a User. Accepts two token types:
 *  - Firebase ID tokens (used by the web UI)
 *  - CLI tokens `ncli-...` (user-scoped, minted via device flow)
 *
 * NOTE: Workspace-scoped MCP tokens `sk-neo-...` are NOT accepted here —
 * they're only valid against /api/mcp via a separate auth layer.
 */
async function resolveUserFromBearer(request: Request): Promise<User> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
  const token = authHeader.slice(7);

  if (token.startsWith("ncli-")) {
    const result = await getCliTokenByHash(hashToken(token));
    if (!result) throw new Error("Not authenticated");
    touchCliTokenLastUsed(result.token.id).catch(() => {});
    return result.user;
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch (err) {
    console.error("verifyIdToken failed:", err instanceof Error ? err.message : err);
    throw new Error("Not authenticated");
  }
  return ensureUserAndPersonalWorkspace({
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
  });
}

/**
 * For routes that need only the user (no workspace context yet), e.g.
 * the workspace-listing endpoint or the invite-acceptance endpoint.
 */
export async function getAuthenticatedUser(request: Request): Promise<User> {
  return resolveUserFromBearer(request);
}

/**
 * For routes that operate inside a specific workspace. Resolves the workspace
 * from the X-Workspace header (slug), falling back to a `?workspace=` query
 * param, falling back to the user's oldest workspace.
 *
 * Throws if the user isn't a member of the resolved workspace.
 */
export async function getAuthenticatedContext(request: Request): Promise<{
  user: User;
  workspace: Workspace;
  role: Role;
}> {
  const user = await resolveUserFromBearer(request);

  const url = new URL(request.url);
  const slugFromHeader = request.headers.get("X-Workspace");
  const slugFromQuery = url.searchParams.get("workspace");
  const slug = slugFromHeader ?? slugFromQuery ?? null;

  let workspace: Workspace | null = null;
  if (slug) {
    workspace = await getWorkspaceBySlug(slug);
  } else {
    const list = await listWorkspacesForUser(user.id);
    if (list.length > 0) workspace = list[0];
  }
  if (!workspace) {
    throw new Error("No workspace");
  }

  const membership = await getMembership(workspace.id, user.id);
  if (!membership) {
    throw new Error("Forbidden");
  }

  return { user, workspace, role: membership.role as Role };
}

/**
 * Helper for routes that require owner role.
 */
export function requireOwner(ctx: { role: Role }) {
  if (ctx.role !== "owner") throw new Error("Forbidden: owner only");
}
