import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/firebase-admin";
import {
  getUserByFirebaseUid,
  createUser,
  getOAuthClient,
  createOAuthCode,
} from "@/lib/db/queries";
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
    } = await request.json();

    if (!idToken || !clientId || !redirectUri || !codeChallenge) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Verify the Firebase ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Get or create user
    let user = await getUserByFirebaseUid(decoded.uid);
    if (!user) {
      user = await createUser({
        email: decoded.email ?? "",
        name: decoded.name ?? decoded.email ?? "User",
        firebaseUid: decoded.uid,
      });
    }

    // Verify client exists
    const client = await getOAuthClient(clientId);
    if (!client) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Unknown client" },
        { status: 400 }
      );
    }

    // Verify redirect_uri is registered
    if (!client.redirectUris.includes(redirectUri)) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Redirect URI not registered" },
        { status: 400 }
      );
    }

    // Generate authorization code
    const code = generateCode();
    await createOAuthCode({
      code,
      clientId,
      userId: user.id,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod ?? "S256",
    });

    // Build redirect URL with code
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
