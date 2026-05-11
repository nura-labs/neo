import { eq, and, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeNodes } from "@/lib/db/schema";

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export async function generateUniqueSlug(
  workspaceId: string,
  title: string
): Promise<string> {
  const base = generateSlug(title);
  if (!base) return `node-${Date.now()}`;

  const existing = await db
    .select({ slug: knowledgeNodes.slug })
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.workspaceId, workspaceId),
        like(knowledgeNodes.slug, `${base}%`)
      )
    );

  const slugs = new Set(existing.map((r) => r.slug));

  if (!slugs.has(base)) return base;

  let i = 2;
  while (slugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
