import { NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/db/queries";
import { generateClientId, generateClientSecret } from "@/lib/oauth/pkce";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { redirect_uris, client_name } = body;

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
        { status: 400 }
      );
    }

    const clientId = generateClientId();
    const clientSecret = generateClientSecret();

    const client = await createOAuthClient({
      clientId,
      clientSecret,
      redirectUris: redirect_uris,
      clientName: client_name,
    });

    return NextResponse.json({
      client_id: client.clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: client.redirectUris,
      client_name: client.clientName,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    }, { status: 201 });
  } catch (error) {
    console.error("Client registration error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to register client" },
      { status: 500 }
    );
  }
}
