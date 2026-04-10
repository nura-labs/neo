import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("neo-session");
  const { pathname } = request.nextUrl;

  // Public routes - no auth required
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/authorize") ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/api/.well-known") ||
    pathname.startsWith("/api/register") ||
    pathname.startsWith("/api/token") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/sse") ||
    pathname.startsWith("/api/transport") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // MCP [transport] route handles its own auth via bearer tokens
  if (pathname.match(/^\/api\/[^/]+$/) && !pathname.startsWith("/api/knowledge") && !pathname.startsWith("/api/graph") && !pathname.startsWith("/api/settings")) {
    return NextResponse.next();
  }

  // Dashboard API routes return 401
  if (pathname.startsWith("/api/")) {
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Dashboard routes redirect to login
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
