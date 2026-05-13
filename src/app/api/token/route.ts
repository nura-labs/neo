import { NextResponse } from "next/server";
import {
  getOAuthCode,
  markOAuthCodeUsed,
  getOAuthClient,
  getWorkspaceById,
  createApiToken,
} from "@/lib/db/queries";
import { verifyPkce } from "@/lib/oauth/pkce";
import { generateApiToken } from "@/lib/auth/token";

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

    // Look up the auth code (validates clientId in the same query — fixed gap)
    const authCode = await getOAuthCode(code, clientId);
    if (!authCode) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Invalid or expired authorization code" },
        { status: 400 }
      );
    }

    if (new Date() > authCode.expiresAt) {
      await markOAuthCodeUsed(code);
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Authorization code expired" },
        { status: 400 }
      );
    }

    if (redirectUri && authCode.redirectUri !== redirectUri) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Redirect URI mismatch" },
        { status: 400 }
      );
    }

    if (!verifyPkce(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "PKCE verification failed" },
        { status: 400 }
      );
    }

    if (!authCode.workspaceId) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Authorization code has no workspace" },
        { status: 400 }
      );
    }

    const workspace = await getWorkspaceById(authCode.workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: "server_error", error_description: "Workspace not found" },
        { status: 500 }
      );
    }

    await markOAuthCodeUsed(code);

    const client = await getOAuthClient(clientId);
    const tokenName = client?.clientName
      ? `OAuth: ${client.clientName}`
      : `OAuth client ${clientId}`;

    // Mint a fresh hashed API token; plaintext is returned to the client and
    // never stored. Subsequent MCP requests carry this as a Bearer token.
    const generated = generateApiToken(workspace.slug);
    await createApiToken({
      workspaceId: workspace.id,
      createdByUserId: authCode.userId,
      name: tokenName,
      tokenPrefix: generated.prefix,
      tokenHash: generated.hash,
      scopes: ["read", "write"],
    });

    return NextResponse.json({
      access_token: generated.plaintext,
      token_type: "Bearer",
      scope: authCode.scopes.join(" "),
      // Non-standard but useful: tell the caller which workspace the token
      // is scoped to so a CLI doesn't have to make another auth-bearing
      // request just to discover its own context.
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        plan: workspace.plan,
      },
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
