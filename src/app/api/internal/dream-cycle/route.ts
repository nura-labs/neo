import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { runDreamCycle } from "@/lib/knowledge/dream-cycle";

export const maxDuration = 900; // 15 minutes for Cloud Run

export async function POST(request: Request) {
  // Auth handled by Cloud Run IAM — Cloud Scheduler uses OIDC token
  // with the service account that has roles/run.invoker permission.
  // No custom auth needed for internal endpoints.

  const url = new URL(request.url);
  const targetWorkspaceId = url.searchParams.get("workspace_id");

  let workspaceIds: string[];

  if (targetWorkspaceId) {
    workspaceIds = [targetWorkspaceId];
  } else {
    const all = await db.select({ id: workspaces.id }).from(workspaces);
    workspaceIds = all.map((w) => w.id);
  }

  const results = [];
  for (const workspaceId of workspaceIds) {
    try {
      const result = await runDreamCycle(workspaceId);
      results.push(result);
    } catch (err) {
      results.push({
        workspaceId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    workspacesProcessed: workspaceIds.length,
    results,
  });
}
