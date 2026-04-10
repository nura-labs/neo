import { adminAuth } from "./firebase-admin";
import { getUserByFirebaseUid, createUser } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";

export async function getAuthenticatedUser(request: Request): Promise<User> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Not authenticated");
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch (err) {
    console.error("verifyIdToken failed:", err instanceof Error ? err.message : err);
    throw new Error("Not authenticated");
  }

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
