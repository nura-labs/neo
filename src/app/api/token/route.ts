import { NextResponse } from "next/server";
import { getOAuthCode, markOAuthCodeUsed, getOAuthClient, getUserById } from "@/lib/db/queries";
import { verifyPkce } from "@/lib/oauth/pkce";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let params: URLSearchParams;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await request.text();
      params = new URLSearchParams(body);
    } else {
      const body = await request.json();
      params = new URLSearchParams(body);
    }

    const grantType = params.get("grant_type");
    const code = params.get("code");
    const codeVerifier = params.get("code_verifier");
    const clientId = params.get("client_id");
    const redirectUri = params.get("redirect_uri");

    if (grantType !== "authorization_code") {
      return NextResponse.json(
        { error: "unsupported_grant_type" },
        { status: 400 }
      );
    }

    if (!code || !codeVerifier || !clientId) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Look up the auth code
    const authCode = await getOAuthCode(code);
    if (!authCode) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Invalid or expired authorization code" },
        { status: 400 }
      );
    }

    // Verify expiration
    if (new Date() > authCode.expiresAt) {
      await markOAuthCodeUsed(code);
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Authorization code expired" },
        { status: 400 }
      );
    }

    // Verify client_id matches
    if (authCode.clientId !== clientId) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Client mismatch" },
        { status: 400 }
      );
    }

    // Verify redirect_uri matches (if provided)
    if (redirectUri && authCode.redirectUri !== redirectUri) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Redirect URI mismatch" },
        { status: 400 }
      );
    }

    // Verify PKCE
    if (!verifyPkce(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "PKCE verification failed" },
        { status: 400 }
      );
    }

    // Mark code as used
    await markOAuthCodeUsed(code);

    // Get the user's API token
    const user = await getUserById(authCode.userId);
    if (!user) {
      return NextResponse.json(
        { error: "server_error", error_description: "User not found" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      access_token: user.apiToken,
      token_type: "Bearer",
      scope: authCode.scopes.join(" "),
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
