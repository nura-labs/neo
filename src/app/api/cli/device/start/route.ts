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
export async function POST(_request: Request) {
  const TTL_MS = 10 * 60 * 1000;

  // Try a few times in case of the (astronomically unlikely) duplicate code
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const userCode = generateDeviceUserCode();
      const expiresAt = new Date(Date.now() + TTL_MS);
      const session = await createCliDeviceSession({ userCode, expiresAt });
      const base = new URL(_request.url).origin;
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
