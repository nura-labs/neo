import { NextResponse } from "next/server";
import {
  attachUserToDeviceSession,
  createCliToken,
  getCliDeviceSessionByCode,
} from "@/lib/db/queries";
import { getAuthenticatedUser } from "@/lib/auth/api";
import { generateCliToken } from "@/lib/auth/token";

/**
 * Step 2 of the CLI device flow.
 *
 * The user, after signing in at /cli, POSTs here with the user_code from the
 * CLI to confirm authorization. We:
 *   1. Mint a fresh user-scoped CLI token (`ncli-{hex}`) for the user
 *   2. Stash the plaintext on the device session row (briefly)
 *   3. Attach user_id + cli_token_id to the session
 *
 * The CLI's next /exchange poll then drains and returns the plaintext.
 *
 * Requires Firebase auth — the caller is the human authorizing the CLI.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { user_code } = body as { user_code?: string };
  if (!user_code) {
    return NextResponse.json(
      { error: "invalid_request", detail: "user_code is required" },
      { status: 400 }
    );
  }

  const session = await getCliDeviceSessionByCode(user_code);
  if (!session) {
    return NextResponse.json(
      { error: "invalid_code", detail: "Code not found." },
      { status: 404 }
    );
  }
  if (session.consumedAt) {
    return NextResponse.json(
      { error: "consumed", detail: "This code has already been used." },
      { status: 409 }
    );
  }
  if (session.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "expired", detail: "Code has expired. Run `neo auth login` again to get a new one." },
      { status: 410 }
    );
  }
  if (session.userId) {
    return NextResponse.json(
      { error: "already_authorized", detail: "This code is already authorized." },
      { status: 409 }
    );
  }

  // Mint the CLI token and stash plaintext on the session row briefly.
  const generated = generateCliToken();
  const token = await createCliToken({
    userId: user.id,
    name: `Neo CLI (${new Date().toISOString().slice(0, 10)})`,
    tokenPrefix: generated.prefix,
    tokenHash: generated.hash,
  });
  const ok = await attachUserToDeviceSession(
    session.userCode,
    user.id,
    token.id,
    generated.plaintext
  );
  if (!ok) {
    return NextResponse.json(
      { error: "race", detail: "Session was changed concurrently. Run `neo auth login` again." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
