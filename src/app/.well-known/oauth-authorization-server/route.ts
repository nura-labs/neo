import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  return NextResponse.json({
    issuer: APP_URL,
    authorization_endpoint: `${APP_URL}/authorize`,
    token_endpoint: `${APP_URL}/api/token`,
    registration_endpoint: `${APP_URL}/api/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["read", "write"],
    service_documentation: `${APP_URL}`,
  });
}
