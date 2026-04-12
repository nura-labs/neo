import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { runDreamCycle } from "@/lib/knowledge/dream-cycle";

export const maxDuration = 900; // 15 minutes for Cloud Run

export async function POST(request: Request) {
  // Auth handled by Cloud Run IAM — Cloud Scheduler uses OIDC token
  // with the service account that has roles/run.invoker permission.
  // No custom auth needed for internal endpoints.

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("user_id");

  let userIds: string[];

  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    const allUsers = await db.select({ id: users.id }).from(users);
    userIds = allUsers.map((u) => u.id);
  }

  const results = [];
  for (const userId of userIds) {
    try {
      const result = await runDreamCycle(userId);
      results.push(result);
    } catch (err) {
      results.push({
        userId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    usersProcessed: userIds.length,
    results,
  });
}
