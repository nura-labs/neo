import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";
import { getUserByFirebaseUid, createUser } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

const SESSION_COOKIE_NAME = "neo-session";

export async function getAuthenticatedUser(): Promise<User> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    throw new Error("Not authenticated");
  }

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
}
