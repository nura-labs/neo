import { NextResponse } from "next/server";
import { createCliDeviceSession } from "@/lib/db/queries";
import { generateDeviceUserCode } from "@/lib/auth/token";

/**
 * Step 1 of the CLI device flow.
 *
 * The CLI POSTs here to start a session. We mint a short user_code (e.g.
 * "ENNA-YASA") and return it alongside a verification URL. The CLI then opens
 * the browser to the URL — there the user signs in and confirms the code.
 *
 * Anonymous endpoint (no auth header). Sessions expire after 10 minutes.
 */
function publicOrigin(request: Request): string {
  // Prefer the configured public URL (set in cloudbuild) — `request.url` on
  // Cloud Run behind a load balancer points at the internal 0.0.0.0:8080.
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const TTL_MS = 10 * 60 * 1000;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const userCode = generateDeviceUserCode();
      const expiresAt = new Date(Date.now() + TTL_MS);
      const session = await createCliDeviceSession({ userCode, expiresAt });
      const base = publicOrigin(request);
      return NextResponse.json({
        authorization_session_id: session.id,
        user_code: session.userCode,
        verification_url: `${base}/cli?code=${session.userCode}`,
        expires_at: session.expiresAt.toISOString(),
        interval: 2,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") && attempt < 4) continue;
      console.error("cli device start failed:", msg);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "could_not_generate_code" }, { status: 500 });
}
