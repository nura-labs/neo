import { NextResponse } from "next/server";
import {
  consumeCliDeviceSession,
  getCliDeviceSessionByCode,
} from "@/lib/db/queries";

/**
 * Step 3 of the CLI device flow.
 *
 * The CLI polls this endpoint with `authorization_session_id` + `user_code`.
 * State machine:
 *   - session not authorized yet:   400 not_ready
 *   - session expired:              410 expired
 *   - session already consumed:     409 consumed
 *   - session authorized:           200 { api_key }
 *
 * The api_key is delivered ONCE. The plaintext is stashed in the session row
 * by /api/cli/device/confirm and atomically returned + nulled here.
 */
export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { authorization_session_id, user_code } = body as {
    authorization_session_id?: string;
    user_code?: string;
  };
  if (!authorization_session_id || !user_code) {
    return NextResponse.json(
      { error: "invalid_request", detail: "authorization_session_id and user_code are required" },
      { status: 400 }
    );
  }

  const session = await getCliDeviceSessionByCode(user_code);
  if (!session || session.id !== authorization_session_id) {
    return NextResponse.json(
      { error: "invalid", detail: "Invalid session or code" },
      { status: 404 }
    );
  }
  if (session.consumedAt) {
    return NextResponse.json(
      { error: "consumed", detail: "This session has already been used." },
      { status: 409 }
    );
  }
  if (session.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "expired", detail: "Session has expired." },
      { status: 410 }
    );
  }
  if (!session.userId || !session.cliTokenId) {
    return NextResponse.json(
      { error: "not_ready", detail: "Session not yet authorized. Complete the browser sign-in first." },
      { status: 400 }
    );
  }

  const consumed = await consumeCliDeviceSession(session.id);
  if (!consumed) {
    return NextResponse.json(
      { error: "consumed", detail: "This session has already been used." },
      { status: 409 }
    );
  }

  return NextResponse.json({ api_key: consumed.plaintext });
}
