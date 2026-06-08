import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  return NextResponse.json({
    resource: `${APP_URL}/api/mcp`,
    authorization_servers: [APP_URL],
    scopes_supported: ["read", "write"],
    bearer_methods_supported: ["header"],
    resource_name: "Neo Knowledge Graph",
    resource_documentation: APP_URL,
  });
}
