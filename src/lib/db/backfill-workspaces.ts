/**
 * Backfill workspaces, memberships, and tenant FKs for every existing user.
 * Runs as a manual data step BETWEEN drizzle migrations 0004 and 0005.
 *
 * Safe to re-run: only processes users where `username IS NULL`. Each user's
 * 6-step backfill happens in its own transaction so a single bad row does not
 * abort the whole script.
 *
 * Deploy order:
 *   1. npx drizzle-kit migrate         # applies 0004 (additive tables + nullable cols)
 *   2. npx tsx src/lib/db/backfill-workspaces.ts
 *   3. npx drizzle-kit migrate         # applies 0005 (NOT NULL + drop api_token)
 */

import { eq, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  workspaces,
  memberships,
  knowledgeNodes,
  knowledgeEdges,
  dreamSuggestions,
} from "./schema";
import {
  deriveUsername,
  generateUniqueUsername,
  generateUniqueWorkspaceSlug,
  isReservedName,
} from "../utils/username";

interface BackfillResult {
  userId: string;
  email: string;
  username: string;
  workspaceId: string;
  workspaceSlug: string;
  nodes: number;
  edges: number;
  suggestions: number;
}

async function backfillUser(user: { id: string; email: string; name: string }): Promise<BackfillResult> {
  return db.transaction(async (tx) => {
    // 1. derive username — uses outer db queries via the helper since we don't
    //    have a tx-scoped variant; collisions across concurrent runs are
    //    impossible because we're single-threaded here.
    const username = await generateUniqueUsername(user.email);

    // 2. derive workspace slug from the user's display name (falls back to username)
    const slugSeed = `${user.name || username}-personal`;
    const slug = await generateUniqueWorkspaceSlug(slugSeed);

    // 3. create personal workspace
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        slug,
        name: `${user.name || username}'s workspace`,
        createdByUserId: user.id,
      })
      .returning({ id: workspaces.id, slug: workspaces.slug });

    // 4. owner membership
    await tx.insert(memberships).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    // 5. backfill nodes — set workspace_id and created_by_user_id
    const nodesUpdated = await tx
      .update(knowledgeNodes)
      .set({
        workspaceId: workspace.id,
        createdByUserId: user.id,
      })
      .where(eq(knowledgeNodes.userId, user.id))
      .returning({ id: knowledgeNodes.id });

    // 6. backfill edges — workspace_id via the source node's user_id
    //    (any edge whose source belongs to this user is this user's edge)
    const edgesUpdated = await tx.execute(sql`
      UPDATE knowledge_edges ke
         SET workspace_id = ${workspace.id}
        FROM knowledge_nodes kn
       WHERE kn.id = ke.source_id
         AND kn.user_id = ${user.id}
       RETURNING ke.id
    `);

    // 7. backfill suggestions
    const suggestionsUpdated = await tx
      .update(dreamSuggestions)
      .set({ workspaceId: workspace.id })
      .where(eq(dreamSuggestions.userId, user.id))
      .returning({ id: dreamSuggestions.id });

    // 8. set username last so re-running the script picks up users we already processed
    //    (the script's selector is `WHERE username IS NULL`)
    await tx.update(users).set({ username }).where(eq(users.id, user.id));

    return {
      userId: user.id,
      email: user.email,
      username,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      nodes: nodesUpdated.length,
      edges: (edgesUpdated.rows ?? []).length,
      suggestions: suggestionsUpdated.length,
    };
  });
}

async function main() {
  console.log("[backfill] starting workspace backfill");

  const pending = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(isNull(users.username));

  console.log(`[backfill] ${pending.length} users to process`);

  const results: BackfillResult[] = [];
  const failures: Array<{ userId: string; email: string; error: string }> = [];

  for (const user of pending) {
    try {
      const result = await backfillUser(user);
      results.push(result);
      console.log(
        `[backfill] ✓ ${result.email} → @${result.username} → ${result.workspaceSlug} ` +
          `(${result.nodes} nodes, ${result.edges} edges, ${result.suggestions} suggestions)`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ userId: user.id, email: user.email, error: message });
      console.error(`[backfill] ✗ ${user.email}: ${message}`);
    }
  }

  console.log("");
  console.log(`[backfill] DONE. ${results.length} succeeded, ${failures.length} failed.`);

  if (failures.length) {
    console.error("[backfill] failures:");
    for (const f of failures) {
      console.error(`  - ${f.email} (${f.userId}): ${f.error}`);
    }
    process.exit(1);
  }

  // Sanity check: make sure no orphaned data remains
  const orphanNodes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeNodes)
    .where(isNull(knowledgeNodes.workspaceId));
  const orphanEdges = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeEdges)
    .where(isNull(knowledgeEdges.workspaceId));
  const orphanSuggestions = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dreamSuggestions)
    .where(isNull(dreamSuggestions.workspaceId));

  console.log("");
  console.log(
    `[backfill] sanity: orphan nodes=${orphanNodes[0].count} edges=${orphanEdges[0].count} suggestions=${orphanSuggestions[0].count}`
  );

  if (
    orphanNodes[0].count > 0 ||
    orphanEdges[0].count > 0 ||
    orphanSuggestions[0].count > 0
  ) {
    console.error(
      "[backfill] ⚠ orphaned rows remain. DO NOT run migration 0006 until these are resolved."
    );
    process.exit(1);
  }

  console.log("[backfill] ✓ no orphans. Safe to run migration 0006.");
  process.exit(0);
}

// Suppress lint for unused import; kept for future use of deriveUsername / isReservedName
void deriveUsername;
void isReservedName;

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
