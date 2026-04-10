import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";
import { getUserByFirebaseUid, createUser } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

const SESSION_COOKIE_NAME = "neo-session";

export async function verifySession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) return null;

    // Verify the Firebase ID token directly (like orkest does)
    const decoded = await adminAuth.verifyIdToken(sessionCookie, false);

    let user = await getUserByFirebaseUid(decoded.uid);

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

export { SESSION_COOKIE_NAME };
