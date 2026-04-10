import { eq, and, sql, desc, arrayContains, inArray } from "drizzle-orm";
import { db } from "./index";
import { users, knowledgeNodes, knowledgeEdges } from "./schema";
import type {
  User,
  KnowledgeNode,
  KnowledgeEdge,
  NewKnowledgeNode,
} from "./schema";
import type { CreateNodeInput, UpdateNodeInput } from "../validators/knowledge";
import { randomBytes } from "crypto";

// ─── Users ──────────────────────────────────────────────

export function generateApiToken(): string {
  return `sk-neo-${randomBytes(24).toString("hex")}`;
}

export async function createUser(data: {
  email: string;
  name: string;
  firebaseUid: string;
}): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      ...data,
      apiToken: generateApiToken(),
    })
    .returning();
  return user;
}

export async function getUserByFirebaseUid(
  firebaseUid: string
): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return user ?? null;
}

export async function getUserByApiToken(
  apiToken: string
): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.apiToken, apiToken))
    .limit(1);
  return user ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

export async function regenerateApiToken(userId: string): Promise<string> {
  const newToken = generateApiToken();
  await db
    .update(users)
    .set({ apiToken: newToken })
    .where(eq(users.id, userId));
  return newToken;
}

// ─── Knowledge Nodes ────────────────────────────────────

export async function createNode(
  userId: string,
  input: CreateNodeInput
): Promise<KnowledgeNode> {
  const { relatedTo, ...nodeData } = input;

  const [node] = await db
    .insert(knowledgeNodes)
    .values({
      userId,
      type: nodeData.type,
      title: nodeData.title,
      content: nodeData.content,
      tags: nodeData.tags ?? [],
      source: nodeData.source ?? null,
      sourceMeta: nodeData.sourceMeta ?? {},
    })
    .returning();

  if (relatedTo && relatedTo.length > 0) {
    await db.insert(knowledgeEdges).values(
      relatedTo.map((rel) => ({
        sourceId: node.id,
        targetId: rel.id,
        relationship: rel.relationship,
      }))
    );
  }

  return node;
}

export async function updateNode(
  nodeId: string,
  userId: string,
  input: UpdateNodeInput
): Promise<KnowledgeNode | null> {
  const [node] = await db
    .update(knowledgeNodes)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(knowledgeNodes.id, nodeId), eq(knowledgeNodes.userId, userId)))
    .returning();
  return node ?? null;
}

export async function deleteNode(
  nodeId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(knowledgeNodes)
    .where(and(eq(knowledgeNodes.id, nodeId), eq(knowledgeNodes.userId, userId)))
    .returning({ id: knowledgeNodes.id });
  return result.length > 0;
}

export async function getNodeById(
  nodeId: string,
  userId: string
): Promise<KnowledgeNode | null> {
  const [node] = await db
    .select()
    .from(knowledgeNodes)
    .where(and(eq(knowledgeNodes.id, nodeId), eq(knowledgeNodes.userId, userId)))
    .limit(1);
  return node ?? null;
}

export async function getNodesByUser(
  userId: string,
  filters?: {
    type?: string;
    source?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  }
): Promise<{ nodes: KnowledgeNode[]; total: number }> {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [eq(knowledgeNodes.userId, userId)];

  if (filters?.type) {
    conditions.push(eq(knowledgeNodes.type, filters.type));
  }
  if (filters?.source) {
    conditions.push(eq(knowledgeNodes.source, filters.source));
  }
  if (filters?.tags && filters.tags.length > 0) {
    conditions.push(arrayContains(knowledgeNodes.tags, filters.tags));
  }

  const where = and(...conditions);

  const [nodes, countResult] = await Promise.all([
    db
      .select()
      .from(knowledgeNodes)
      .where(where)
      .orderBy(desc(knowledgeNodes.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeNodes)
      .where(where),
  ]);

  return { nodes, total: countResult[0]?.count ?? 0 };
}

export async function searchNodes(
  userId: string,
  query: string,
  filters?: { type?: string; source?: string; tags?: string[] }
): Promise<KnowledgeNode[]> {
  const conditions = [eq(knowledgeNodes.userId, userId)];

  if (filters?.type) {
    conditions.push(eq(knowledgeNodes.type, filters.type));
  }
  if (filters?.source) {
    conditions.push(eq(knowledgeNodes.source, filters.source));
  }
  if (filters?.tags && filters.tags.length > 0) {
    conditions.push(arrayContains(knowledgeNodes.tags, filters.tags));
  }

  const nodes = await db
    .select({
      id: knowledgeNodes.id,
      userId: knowledgeNodes.userId,
      type: knowledgeNodes.type,
      title: knowledgeNodes.title,
      content: knowledgeNodes.content,
      tags: knowledgeNodes.tags,
      source: knowledgeNodes.source,
      sourceMeta: knowledgeNodes.sourceMeta,
      createdAt: knowledgeNodes.createdAt,
      updatedAt: knowledgeNodes.updatedAt,
      rank: sql<number>`ts_rank(
        setweight(to_tsvector('english', ${knowledgeNodes.title}), 'A') ||
        setweight(to_tsvector('english', ${knowledgeNodes.content}), 'B'),
        plainto_tsquery('english', ${query})
      )`.as("rank"),
    })
    .from(knowledgeNodes)
    .where(
      and(
        ...conditions,
        sql`(
          setweight(to_tsvector('english', ${knowledgeNodes.title}), 'A') ||
          setweight(to_tsvector('english', ${knowledgeNodes.content}), 'B')
        ) @@ plainto_tsquery('english', ${query})`
      )
    )
    .orderBy(sql`rank DESC`)
    .limit(20);

  return nodes;
}

export async function getOverview(userId: string) {
  const [nodeCount, edgeCount, typeBreakdown, sourceBreakdown, recentNodes] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.userId, userId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeEdges)
        .innerJoin(
          knowledgeNodes,
          eq(knowledgeEdges.sourceId, knowledgeNodes.id)
        )
        .where(eq(knowledgeNodes.userId, userId)),
      db
        .select({
          type: knowledgeNodes.type,
          count: sql<number>`count(*)::int`,
        })
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.userId, userId))
        .groupBy(knowledgeNodes.type),
      db
        .select({
          source: knowledgeNodes.source,
          count: sql<number>`count(*)::int`,
        })
        .from(knowledgeNodes)
        .where(
          and(
            eq(knowledgeNodes.userId, userId),
            sql`${knowledgeNodes.source} IS NOT NULL`
          )
        )
        .groupBy(knowledgeNodes.source),
      db
        .select()
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.userId, userId))
        .orderBy(desc(knowledgeNodes.updatedAt))
        .limit(5),
    ]);

  return {
    totalNodes: nodeCount[0]?.count ?? 0,
    totalEdges: edgeCount[0]?.count ?? 0,
    typeBreakdown: typeBreakdown as { type: string; count: number }[],
    sourceBreakdown: sourceBreakdown as { source: string | null; count: number }[],
    recentNodes,
  };
}

// ─── Knowledge Edges ────────────────────────────────────

export async function createEdge(data: {
  sourceId: string;
  targetId: string;
  relationship: string;
  weight?: number;
}): Promise<KnowledgeEdge> {
  const [edge] = await db
    .insert(knowledgeEdges)
    .values({
      sourceId: data.sourceId,
      targetId: data.targetId,
      relationship: data.relationship,
      weight: data.weight ?? 1.0,
    })
    .onConflictDoNothing()
    .returning();
  return edge;
}

export async function deleteEdge(edgeId: string): Promise<boolean> {
  const result = await db
    .delete(knowledgeEdges)
    .where(eq(knowledgeEdges.id, edgeId))
    .returning({ id: knowledgeEdges.id });
  return result.length > 0;
}

export async function getRelatedNodes(
  nodeId: string,
  userId: string,
  filters?: { relationship?: string }
): Promise<
  { node: KnowledgeNode; edge: KnowledgeEdge; direction: "outgoing" | "incoming" }[]
> {
  const outgoingConditions = [eq(knowledgeEdges.sourceId, nodeId)];
  const incomingConditions = [eq(knowledgeEdges.targetId, nodeId)];

  if (filters?.relationship) {
    outgoingConditions.push(
      eq(knowledgeEdges.relationship, filters.relationship)
    );
    incomingConditions.push(
      eq(knowledgeEdges.relationship, filters.relationship)
    );
  }

  const [outgoing, incoming] = await Promise.all([
    db
      .select({ node: knowledgeNodes, edge: knowledgeEdges })
      .from(knowledgeEdges)
      .innerJoin(
        knowledgeNodes,
        eq(knowledgeEdges.targetId, knowledgeNodes.id)
      )
      .where(and(...outgoingConditions, eq(knowledgeNodes.userId, userId))),
    db
      .select({ node: knowledgeNodes, edge: knowledgeEdges })
      .from(knowledgeEdges)
      .innerJoin(
        knowledgeNodes,
        eq(knowledgeEdges.sourceId, knowledgeNodes.id)
      )
      .where(and(...incomingConditions, eq(knowledgeNodes.userId, userId))),
  ]);

  return [
    ...outgoing.map((r) => ({ ...r, direction: "outgoing" as const })),
    ...incoming.map((r) => ({ ...r, direction: "incoming" as const })),
  ];
}

// ─── Graph Data ─────────────────────────────────────────

export async function getGraphData(userId: string) {
  const [nodes, edges] = await Promise.all([
    db
      .select({
        id: knowledgeNodes.id,
        title: knowledgeNodes.title,
        type: knowledgeNodes.type,
        source: knowledgeNodes.source,
        tags: knowledgeNodes.tags,
      })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.userId, userId)),
    db
      .select({
        id: knowledgeEdges.id,
        sourceId: knowledgeEdges.sourceId,
        targetId: knowledgeEdges.targetId,
        relationship: knowledgeEdges.relationship,
        weight: knowledgeEdges.weight,
      })
      .from(knowledgeEdges)
      .innerJoin(
        knowledgeNodes,
        eq(knowledgeEdges.sourceId, knowledgeNodes.id)
      )
      .where(eq(knowledgeNodes.userId, userId)),
  ]);

  const edgeCounts = new Map<string, number>();
  for (const edge of edges) {
    edgeCounts.set(edge.sourceId, (edgeCounts.get(edge.sourceId) ?? 0) + 1);
    edgeCounts.set(edge.targetId, (edgeCounts.get(edge.targetId) ?? 0) + 1);
  }

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.title,
      type: n.type,
      source: n.source,
      val: Math.max(1, edgeCounts.get(n.id) ?? 0),
    })),
    links: edges.map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      name: e.relationship,
    })),
  };
}
