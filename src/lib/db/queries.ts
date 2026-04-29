import { eq, and, sql, desc, arrayContains, inArray, lt } from "drizzle-orm";
import { db } from "./index";
import { users, knowledgeNodes, knowledgeEdges, dreamSuggestions, oauthClients, oauthCodes } from "./schema";
import type {
  User,
  KnowledgeNode,
  KnowledgeEdge,
  NewKnowledgeNode,
  DreamSuggestion,
} from "./schema";
import type { CreateNodeInput, UpdateNodeInput } from "../validators/knowledge";
import { randomBytes } from "crypto";
import { generateSlug, generateUniqueSlug } from "../utils/slugify";
import { syncWikilinkEdges } from "../knowledge/sync-edges";
import { generateNodeEmbedding } from "../knowledge/embeddings";

// ─── Embedding Helper ──────────────────────────────────

function updateEmbeddingInBackground(nodeId: string, title: string, content: string) {
  generateNodeEmbedding(title, content)
    .then((embedding) =>
      db
        .update(knowledgeNodes)
        .set({ embedding })
        .where(eq(knowledgeNodes.id, nodeId))
    )
    .catch((err) => console.error(`Embedding failed for node ${nodeId}:`, err));
}

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

  const slug = await generateUniqueSlug(userId, nodeData.title);

  const [node] = await db
    .insert(knowledgeNodes)
    .values({
      userId,
      slug,
      type: nodeData.type,
      title: nodeData.title,
      content: nodeData.content,
      tags: nodeData.tags ?? [],
      source: nodeData.source ?? null,
      sourceMeta: nodeData.sourceMeta ?? {},
    })
    .returning();

  if (relatedTo && relatedTo.length > 0) {
    await Promise.all(
      relatedTo.map((rel) =>
        createEdge({
          sourceId: node.id,
          targetId: rel.id,
          relationship: rel.relationship,
        })
      )
    );
  }

  // Auto-generate edges from [[wikilinks]] in content
  await syncWikilinkEdges(userId, node.id, node.content);

  // Generate embedding in background (non-blocking)
  updateEmbeddingInBackground(node.id, node.title, node.content);

  return node;
}

export async function updateNode(
  nodeId: string,
  userId: string,
  input: UpdateNodeInput
): Promise<KnowledgeNode | null> {
  const updates: Record<string, unknown> = {
    ...input,
    updatedAt: new Date(),
  };

  if (input.title) {
    updates.slug = await generateUniqueSlug(userId, input.title);
  }

  const [node] = await db
    .update(knowledgeNodes)
    .set(updates)
    .where(and(eq(knowledgeNodes.id, nodeId), eq(knowledgeNodes.userId, userId)))
    .returning();

  if (!node) return null;

  // Re-sync wikilink edges when content changes
  if (input.content) {
    await syncWikilinkEdges(userId, nodeId, input.content);
  }

  // Regenerate embedding if title or content changed
  if (input.title || input.content) {
    updateEmbeddingInBackground(nodeId, node.title, node.content);
  }

  return node;
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

export async function getNodeBySlug(
  slug: string,
  userId: string
): Promise<KnowledgeNode | null> {
  const [node] = await db
    .select()
    .from(knowledgeNodes)
    .where(and(eq(knowledgeNodes.slug, slug), eq(knowledgeNodes.userId, userId)))
    .limit(1);
  return node ?? null;
}

export async function findNodeBySlugOrTitle(
  identifier: string,
  userId: string
): Promise<KnowledgeNode | null> {
  const slug = generateSlug(identifier);
  const conditions = slug
    ? and(
        eq(knowledgeNodes.userId, userId),
        sql`(${knowledgeNodes.slug} = ${slug} OR ${knowledgeNodes.title} = ${identifier})`
      )
    : and(eq(knowledgeNodes.userId, userId), eq(knowledgeNodes.title, identifier));

  const [node] = await db
    .select()
    .from(knowledgeNodes)
    .where(conditions)
    .orderBy(
      sql`CASE
        WHEN ${knowledgeNodes.slug} = ${slug} THEN 0
        WHEN ${knowledgeNodes.title} = ${identifier} THEN 1
        ELSE 2
      END`,
      desc(knowledgeNodes.updatedAt)
    )
    .limit(1);
  return node ?? null;
}

export async function nodesShareUser(
  sourceId: string,
  targetId: string
): Promise<boolean> {
  const endpoints = await db
    .select({ id: knowledgeNodes.id, userId: knowledgeNodes.userId })
    .from(knowledgeNodes)
    .where(inArray(knowledgeNodes.id, [sourceId, targetId]));

  const source = endpoints.find((node) => node.id === sourceId);
  const target = endpoints.find((node) => node.id === targetId);

  return Boolean(source && target && source.userId === target.userId);
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
      slug: knowledgeNodes.slug,
      type: knowledgeNodes.type,
      title: knowledgeNodes.title,
      content: knowledgeNodes.content,
      tags: knowledgeNodes.tags,
      source: knowledgeNodes.source,
      sourceMeta: knowledgeNodes.sourceMeta,
      embedding: knowledgeNodes.embedding,
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

export async function semanticSearch(
  userId: string,
  queryEmbedding: number[],
  filters?: { type?: string; source?: string; tags?: string[] }
): Promise<KnowledgeNode[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  const conditions = [
    eq(knowledgeNodes.userId, userId),
    sql`${knowledgeNodes.embedding} IS NOT NULL`,
  ];

  if (filters?.type) conditions.push(eq(knowledgeNodes.type, filters.type));
  if (filters?.source) conditions.push(eq(knowledgeNodes.source, filters.source));
  if (filters?.tags && filters.tags.length > 0) {
    conditions.push(arrayContains(knowledgeNodes.tags, filters.tags));
  }

  const nodes = await db
    .select()
    .from(knowledgeNodes)
    .where(and(...conditions))
    .orderBy(sql`embedding <=> ${vectorStr}::vector`)
    .limit(20);

  return nodes;
}

export async function hybridSearch(
  userId: string,
  query: string,
  queryEmbedding: number[] | null,
  filters?: { type?: string; source?: string; tags?: string[] }
): Promise<KnowledgeNode[]> {
  const textResults = await searchNodes(userId, query, filters);

  if (!queryEmbedding) return textResults;

  const vectorResults = await semanticSearch(userId, queryEmbedding, filters);

  // Reciprocal Rank Fusion (k=60)
  const k = 60;
  const scores = new Map<string, { score: number; node: KnowledgeNode }>();

  textResults.forEach((node, i) => {
    const score = 1 / (k + i + 1);
    scores.set(node.id, { score, node });
  });

  vectorResults.forEach((node, i) => {
    const score = 1 / (k + i + 1);
    const existing = scores.get(node.id);
    if (existing) {
      existing.score += score;
    } else {
      scores.set(node.id, { score, node });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s) => s.node);
}

export async function getOverview(
  userId: string,
  filters?: { source?: string }
) {
  const nodeConditions = [eq(knowledgeNodes.userId, userId)];
  const sourceBreakdownConditions = [
    eq(knowledgeNodes.userId, userId),
    sql`${knowledgeNodes.source} IS NOT NULL`,
  ];

  if (filters?.source) {
    nodeConditions.push(eq(knowledgeNodes.source, filters.source));
    sourceBreakdownConditions.push(eq(knowledgeNodes.source, filters.source));
  }

  const nodeWhere = and(...nodeConditions);

  const [nodeCount, edgeCount, typeBreakdown, sourceBreakdown, recentNodes] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeNodes)
        .where(nodeWhere),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeEdges)
        .innerJoin(
          knowledgeNodes,
          eq(knowledgeEdges.sourceId, knowledgeNodes.id)
        )
        .where(nodeWhere),
      db
        .select({
          type: knowledgeNodes.type,
          count: sql<number>`count(*)::int`,
        })
        .from(knowledgeNodes)
        .where(nodeWhere)
        .groupBy(knowledgeNodes.type),
      db
        .select({
          source: knowledgeNodes.source,
          count: sql<number>`count(*)::int`,
        })
        .from(knowledgeNodes)
        .where(and(...sourceBreakdownConditions))
        .groupBy(knowledgeNodes.source),
      db
        .select()
        .from(knowledgeNodes)
        .where(nodeWhere)
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
  autoGenerated?: boolean;
}): Promise<KnowledgeEdge | null> {
  if (!(await nodesShareUser(data.sourceId, data.targetId))) {
    return null;
  }

  const [edge] = await db
    .insert(knowledgeEdges)
    .values({
      sourceId: data.sourceId,
      targetId: data.targetId,
      relationship: data.relationship,
      weight: data.weight ?? 1.0,
      autoGenerated: data.autoGenerated ?? false,
    })
    .onConflictDoNothing()
    .returning();
  return edge ?? null;
}

export async function getEdgeByNodes(data: {
  sourceId: string;
  targetId: string;
  relationship: string;
}): Promise<KnowledgeEdge | null> {
  const [edge] = await db
    .select()
    .from(knowledgeEdges)
    .where(
      and(
        eq(knowledgeEdges.sourceId, data.sourceId),
        eq(knowledgeEdges.targetId, data.targetId),
        eq(knowledgeEdges.relationship, data.relationship)
      )
    )
    .limit(1);
  return edge ?? null;
}

export async function deleteEdge(edgeId: string, userId: string): Promise<boolean> {
  // Verify the edge belongs to a node owned by this user before deleting
  const result = await db
    .delete(knowledgeEdges)
    .where(
      and(
        eq(knowledgeEdges.id, edgeId),
        sql`EXISTS (
          SELECT 1 FROM knowledge_nodes
          WHERE knowledge_nodes.id = ${knowledgeEdges.sourceId}
            AND knowledge_nodes.user_id = ${userId}
        )`
      )
    )
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

// ─── OAuth ──────────────────────────────────────────────

export async function createOAuthClient(data: {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  clientName?: string;
}) {
  const [client] = await db
    .insert(oauthClients)
    .values(data)
    .returning();
  return client;
}

export async function getOAuthClient(clientId: string) {
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return client ?? null;
}

export async function createOAuthCode(data: {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
}) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const [authCode] = await db
    .insert(oauthCodes)
    .values({ ...data, expiresAt })
    .returning();
  return authCode;
}

export async function getOAuthCode(code: string) {
  const [authCode] = await db
    .select()
    .from(oauthCodes)
    .where(
      and(
        eq(oauthCodes.code, code),
        eq(oauthCodes.used, false)
      )
    )
    .limit(1);
  return authCode ?? null;
}

export async function markOAuthCodeUsed(code: string) {
  await db
    .update(oauthCodes)
    .set({ used: true })
    .where(eq(oauthCodes.code, code));
}

// ─── Dream Suggestions ────────────────────────────────

export async function getPendingSuggestions(
  userId: string
): Promise<DreamSuggestion[]> {
  return db
    .select()
    .from(dreamSuggestions)
    .where(
      and(
        eq(dreamSuggestions.userId, userId),
        eq(dreamSuggestions.status, "pending")
      )
    )
    .orderBy(desc(dreamSuggestions.createdAt))
    .limit(50);
}

export async function resolveSuggestion(
  suggestionId: string,
  userId: string,
  action: "accepted" | "dismissed"
): Promise<DreamSuggestion | null> {
  const [suggestion] = await db
    .update(dreamSuggestions)
    .set({ status: action })
    .where(
      and(
        eq(dreamSuggestions.id, suggestionId),
        eq(dreamSuggestions.userId, userId)
      )
    )
    .returning();
  return suggestion ?? null;
}
