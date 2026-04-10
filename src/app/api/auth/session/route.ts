import { NextResponse } from "next/server";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing idToken" },
        { status: 400 }
      );
    }

    const sessionCookie = await createSessionCookie(idToken);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieValue = [
      `${SESSION_COOKIE_NAME}=${sessionCookie}`,
      `Path=/`,
      `Max-Age=${SESSION_EXPIRY}`,
      `HttpOnly`,
      `SameSite=Lax`,
      isProduction ? `Secure` : "",
    ]
      .filter(Boolean)
      .join("; ");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieValue,
      },
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 401 }
    );
  }
}
