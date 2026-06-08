import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/firebase-admin";
import {
  getUserByFirebaseUid,
  createUser,
  createWorkspace,
  createMembership,
  getWorkspaceBySlug,
  getMembership,
  listWorkspacesForUser,
  getOAuthClient,
  createOAuthCode,
} from "@/lib/db/queries";
import {
  generateUniqueUsername,
  generateUniqueWorkspaceSlug,
} from "@/lib/utils/username";
import { generateCode } from "@/lib/oauth/pkce";

export async function POST(request: Request) {
  try {
    const {
      idToken,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      state,
      workspaceSlug,
    } = await request.json();

    if (!idToken || !clientId || !redirectUri || !codeChallenge) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing required parameters" },
        { status: 400 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    let user = await getUserByFirebaseUid(decoded.uid);
    if (!user) {
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
    }

    // Resolve which workspace this OAuth grant is for. Frontend may pass an
    // explicit slug; otherwise default to the user's oldest workspace.
    let resolvedWorkspaceId: string | null = null;
    if (workspaceSlug) {
      const ws = await getWorkspaceBySlug(workspaceSlug);
      if (!ws) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "Unknown workspace" },
          { status: 400 }
        );
      }
      const membership = await getMembership(ws.id, user.id);
      if (!membership) {
        return NextResponse.json(
          { error: "access_denied", error_description: "Not a member of workspace" },
          { status: 403 }
        );
      }
      resolvedWorkspaceId = ws.id;
    } else {
      const list = await listWorkspacesForUser(user.id);
      if (list.length > 0) resolvedWorkspaceId = list[0].id;
    }

    const client = await getOAuthClient(clientId);
    if (!client) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Unknown client" },
        { status: 400 }
      );
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Redirect URI not registered" },
        { status: 400 }
      );
    }

    const code = generateCode();
    await createOAuthCode({
      code,
      clientId,
      userId: user.id,
      workspaceId: resolvedWorkspaceId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod ?? "S256",
    });

    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (state) redirect.searchParams.set("state", state);

    return NextResponse.json({ redirectUrl: redirect.toString() });
  } catch (error) {
    console.error("Authorize callback error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Authorization failed" },
      { status: 500 }
    );
  }
}
