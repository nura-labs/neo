/**
 * Backfill script: Generate slugs for existing knowledge nodes.
 * Run with: npx tsx src/lib/db/backfill-slugs.ts
 * Idempotent: only updates nodes with null slug.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, isNull } from "drizzle-orm";
import { knowledgeNodes } from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

async function backfill() {
  const nodes = await db
    .select({ id: knowledgeNodes.id, title: knowledgeNodes.title, userId: knowledgeNodes.userId })
    .from(knowledgeNodes)
    .where(isNull(knowledgeNodes.slug));

  console.log(`Found ${nodes.length} nodes without slugs`);

  const slugsByUser = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (!slugsByUser.has(node.userId)) {
      slugsByUser.set(node.userId, new Set());
    }
    const usedSlugs = slugsByUser.get(node.userId)!;

    let slug = generateSlug(node.title);
    if (!slug) slug = `node-${node.id.slice(0, 8)}`;

    if (usedSlugs.has(slug)) {
      let i = 2;
      while (usedSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }

    usedSlugs.add(slug);

    await db
      .update(knowledgeNodes)
      .set({ slug })
      .where(eq(knowledgeNodes.id, node.id));

    console.log(`  ${node.title} → ${slug}`);
  }

  console.log("Backfill complete");
  await pool.end();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
