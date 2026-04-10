import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";
import { getUserByFirebaseUid, createUser } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

const SESSION_COOKIE_NAME = "neo-session";
const SESSION_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds

export async function createSessionCookie(idToken: string): Promise<string> {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY * 1000,
  });
  return sessionCookie;
}

export async function verifySession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) return null;

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    let user = await getUserByFirebaseUid(decoded.uid);

    // Auto-create user on first login
    if (!user) {
      user = await createUser({
        email: decoded.email ?? "",
        name: decoded.name ?? decoded.email ?? "User",
        firebaseUid: decoded.uid,
      });
    }

    return user;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_EXPIRY };
