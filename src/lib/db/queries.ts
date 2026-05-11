import { eq, and, sql, desc, arrayContains, inArray, isNull, gt } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  workspaces,
  memberships,
  invites,
  apiTokens,
  knowledgeNodes,
  knowledgeEdges,
  dreamSuggestions,
  oauthClients,
  oauthCodes,
} from "./schema";
import type {
  User,
  Workspace,
  Membership,
  Invite,
  ApiToken,
  KnowledgeNode,
  KnowledgeEdge,
  DreamSuggestion,
  Role,
} from "./schema";
import type { CreateNodeInput, UpdateNodeInput } from "../validators/knowledge";
import { generateSlug, generateUniqueSlug } from "../utils/slugify";
import { syncWikilinkEdges } from "../knowledge/sync-edges";
import { generateNodeEmbedding } from "../knowledge/embeddings";

// ─── Embedding helper ─────────────────────────────────────

function updateEmbeddingInBackground(nodeId: string, title: string, content: string) {
  generateNodeEmbedding(title, content)
    .then((embedding) =>
      db.update(knowledgeNodes).set({ embedding }).where(eq(knowledgeNodes.id, nodeId))
    )
    .catch((err) => console.error(`Embedding failed for node ${nodeId}:`, err));
}

// ─── Users ────────────────────────────────────────────────

export async function createUser(data: {
  email: string;
  name: string;
  username: string;
  firebaseUid: string;
}): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return user ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user ?? null;
}

// ─── Workspaces ───────────────────────────────────────────

export async function createWorkspace(data: {
  slug: string;
  name: string;
  createdByUserId: string;
  plan?: string;
}): Promise<Workspace> {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      slug: data.slug,
      name: data.name,
      createdByUserId: data.createdByUserId,
      plan: data.plan ?? "free",
    })
    .returning();
  return workspace;
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  return workspace ?? null;
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);
  return workspace ?? null;
}

export async function listWorkspacesForUser(
  userId: string
): Promise<Array<Workspace & { role: Role; memberCount: number }>> {
  const rows = await db
    .select({
      workspace: workspaces,
      role: memberships.role,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM memberships m2 WHERE m2.workspace_id = ${workspaces.id}
      )`.as("member_count"),
    })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(workspaces.createdAt));

  return rows.map((r) => ({
    ...r.workspace,
    role: r.role as Role,
    memberCount: r.memberCount,
  }));
}

export async function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; plan?: string }
): Promise<Workspace | null> {
  const [workspace] = await db
    .update(workspaces)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning();
  return workspace ?? null;
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  const result = await db
    .delete(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .returning({ id: workspaces.id });
  return result.length > 0;
}

// ─── Memberships ──────────────────────────────────────────

export async function createMembership(data: {
  workspaceId: string;
  userId: string;
  role: Role;
}): Promise<Membership> {
  const [membership] = await db.insert(memberships).values(data).returning();
  return membership;
}

export async function getMembership(
  workspaceId: string,
  userId: string
): Promise<Membership | null> {
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, userId)
      )
    )
    .limit(1);
  return membership ?? null;
}

export async function listMembers(
  workspaceId: string
): Promise<Array<{ user: User; role: Role; joinedAt: Date }>> {
  const rows = await db
    .select({ user: users, role: memberships.role, joinedAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(memberships.createdAt);

  return rows.map((r) => ({ user: r.user, role: r.role as Role, joinedAt: r.joinedAt }));
}

export async function removeMembership(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, userId)
      )
    )
    .returning({ id: memberships.id });
  return result.length > 0;
}

export async function countOwners(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberships)
    .where(
      and(eq(memberships.workspaceId, workspaceId), eq(memberships.role, "owner"))
    );
  return row?.count ?? 0;
}

// ─── Invites ──────────────────────────────────────────────

export async function createInvite(data: {
  workspaceId: string;
  email: string;
  role: Role;
  invitedByUserId: string;
  token: string;
  expiresAt: Date;
}): Promise<Invite> {
  const [invite] = await db.insert(invites).values(data).returning();
  return invite;
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);
  return invite ?? null;
}

export async function listPendingInvites(workspaceId: string): Promise<Invite[]> {
  return db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.workspaceId, workspaceId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date())
      )
    )
    .orderBy(desc(invites.createdAt));
}

export async function markInviteAccepted(
  inviteId: string,
  userId: string
): Promise<void> {
  await db
    .update(invites)
    .set({ acceptedAt: new Date(), acceptedByUserId: userId })
    .where(eq(invites.id, inviteId));
}

export async function revokeInvite(
  inviteId: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.workspaceId, workspaceId)))
    .returning({ id: invites.id });
  return result.length > 0;
}

// ─── API Tokens ───────────────────────────────────────────

export async function createApiToken(data: {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes?: string[];
}): Promise<ApiToken> {
  const [token] = await db
    .insert(apiTokens)
    .values({
      workspaceId: data.workspaceId,
      createdByUserId: data.createdByUserId,
      name: data.name,
      tokenPrefix: data.tokenPrefix,
      tokenHash: data.tokenHash,
      scopes: data.scopes ?? ["read", "write"],
    })
    .returning();
  return token;
}

export async function getApiTokenByHash(
  tokenHash: string
): Promise<{ token: ApiToken; workspace: Workspace } | null> {
  const [row] = await db
    .select({ token: apiTokens, workspace: workspaces })
    .from(apiTokens)
    .innerJoin(workspaces, eq(apiTokens.workspaceId, workspaces.id))
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function listApiTokens(workspaceId: string): Promise<ApiToken[]> {
  return db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.workspaceId, workspaceId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeApiToken(
  tokenId: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.workspaceId, workspaceId)))
    .returning({ id: apiTokens.id });
  return result.length > 0;
}

export async function touchApiTokenLastUsed(tokenId: string): Promise<void> {
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, tokenId));
}

// ─── Knowledge Nodes ──────────────────────────────────────

export async function createNode(
  workspaceId: string,
  createdByUserId: string,
  input: CreateNodeInput
): Promise<KnowledgeNode> {
  const { relatedTo, ...nodeData } = input;

  const slug = await generateUniqueSlug(workspaceId, nodeData.title);

  const [node] = await db
    .insert(knowledgeNodes)
    .values({
      userId: createdByUserId, // legacy column kept in sync with creator
      workspaceId,
      createdByUserId,
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
          workspaceId,
          sourceId: node.id,
          targetId: rel.id,
          relationship: rel.relationship,
        })
      )
    );
  }

  // Auto-generate edges from [[wikilinks]] in content
  await syncWikilinkEdges(workspaceId, node.id, node.content);

  // Generate embedding in background (non-blocking)
  updateEmbeddingInBackground(node.id, node.title, node.content);

  return node;
}

export async function updateNode(
  nodeId: string,
  workspaceId: string,
  input: UpdateNodeInput
): Promise<KnowledgeNode | null> {
  const updates: Record<string, unknown> = {
    ...input,
    updatedAt: new Date(),
  };

  if (input.title) {
    updates.slug = await generateUniqueSlug(workspaceId, input.title);
  }

  const [node] = await db
    .update(knowledgeNodes)
    .set(updates)
    .where(
      and(
        eq(knowledgeNodes.id, nodeId),
        eq(knowledgeNodes.workspaceId, workspaceId)
      )
    )
    .returning();

  if (!node) return null;

  // Re-sync wikilink edges when content changes
  if (input.content) {
    await syncWikilinkEdges(workspaceId, nodeId, input.content);
  }

  // Regenerate embedding if title or content changed
  if (input.title || input.content) {
    updateEmbeddingInBackground(nodeId, node.title, node.content);
  }

  return node;
}

export async function deleteNode(
  nodeId: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .delete(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.id, nodeId),
        eq(knowledgeNodes.workspaceId, workspaceId)
      )
    )
    .returning({ id: knowledgeNodes.id });
  return result.length > 0;
}

export async function getNodeById(
  nodeId: string,
  workspaceId: string
): Promise<KnowledgeNode | null> {
  const [node] = await db
    .select()
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.id, nodeId),
        eq(knowledgeNodes.workspaceId, workspaceId)
      )
    )
    .limit(1);
  return node ?? null;
}

export async function getNodeBySlug(
  slug: string,
  workspaceId: string
): Promise<KnowledgeNode | null> {
  const [node] = await db
    .select()
    .from(knowledgeNodes)
    .where(
      and(
        eq(knowledgeNodes.slug, slug),
        eq(knowledgeNodes.workspaceId, workspaceId)
      )
    )
    .limit(1);
  return node ?? null;
}

export async function findNodeBySlugOrTitle(
  identifier: string,
  workspaceId: string
): Promise<KnowledgeNode | null> {
  const slug = generateSlug(identifier);
  const conditions = slug
    ? and(
        eq(knowledgeNodes.workspaceId, workspaceId),
        sql`(${knowledgeNodes.slug} = ${slug} OR ${knowledgeNodes.title} = ${identifier})`
      )
    : and(
        eq(knowledgeNodes.workspaceId, workspaceId),
        eq(knowledgeNodes.title, identifier)
      );

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

/**
 * Validate that two nodes belong to the same workspace. Used by createEdge to
 * prevent cross-workspace edges (which would be a tenant leak).
 */
export async function nodesShareWorkspace(
  sourceId: string,
  targetId: string,
  workspaceId: string
): Promise<boolean> {
  const endpoints = await db
    .select({ id: knowledgeNodes.id, workspaceId: knowledgeNodes.workspaceId })
    .from(knowledgeNodes)
    .where(inArray(knowledgeNodes.id, [sourceId, targetId]));

  const source = endpoints.find((node) => node.id === sourceId);
  const target = endpoints.find((node) => node.id === targetId);

  return Boolean(
    source &&
      target &&
      source.workspaceId === workspaceId &&
      target.workspaceId === workspaceId
  );
}

export async function getNodesByWorkspace(
  workspaceId: string,
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

  const conditions = [eq(knowledgeNodes.workspaceId, workspaceId)];

  if (filters?.type) conditions.push(eq(knowledgeNodes.type, filters.type));
  if (filters?.source) conditions.push(eq(knowledgeNodes.source, filters.source));
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
  workspaceId: string,
  query: string,
  filters?: { type?: string; source?: string; tags?: string[] }
): Promise<KnowledgeNode[]> {
  const conditions = [eq(knowledgeNodes.workspaceId, workspaceId)];

  if (filters?.type) conditions.push(eq(knowledgeNodes.type, filters.type));
  if (filters?.source) conditions.push(eq(knowledgeNodes.source, filters.source));
  if (filters?.tags && filters.tags.length > 0) {
    conditions.push(arrayContains(knowledgeNodes.tags, filters.tags));
  }

  const nodes = await db
    .select({
      id: knowledgeNodes.id,
      userId: knowledgeNodes.userId,
      workspaceId: knowledgeNodes.workspaceId,
      createdByUserId: knowledgeNodes.createdByUserId,
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
  workspaceId: string,
  queryEmbedding: number[],
  filters?: { type?: string; source?: string; tags?: string[] }
): Promise<KnowledgeNode[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  const conditions = [
    eq(knowledgeNodes.workspaceId, workspaceId),
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
  workspaceId: string,
  query: string,
  queryEmbedding: number[] | null,
  filters?: { type?: string; source?: string; tags?: string[] }
): Promise<KnowledgeNode[]> {
  const textResults = await searchNodes(workspaceId, query, filters);

  if (!queryEmbedding) return textResults;

  const vectorResults = await semanticSearch(workspaceId, queryEmbedding, filters);

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

export async function getOverview(workspaceId: string, filters?: { source?: string }) {
  const nodeConditions = [eq(knowledgeNodes.workspaceId, workspaceId)];
  const sourceBreakdownConditions = [
    eq(knowledgeNodes.workspaceId, workspaceId),
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
      // Edges now have workspace_id directly; no need to join through nodes
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeEdges)
        .where(eq(knowledgeEdges.workspaceId, workspaceId)),
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

// ─── Knowledge Edges ──────────────────────────────────────

export async function createEdge(data: {
  workspaceId: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  weight?: number;
  autoGenerated?: boolean;
}): Promise<KnowledgeEdge | null> {
  if (
    !(await nodesShareWorkspace(data.sourceId, data.targetId, data.workspaceId))
  ) {
    return null;
  }

  const [edge] = await db
    .insert(knowledgeEdges)
    .values({
      sourceId: data.sourceId,
      targetId: data.targetId,
      workspaceId: data.workspaceId,
      relationship: data.relationship,
      weight: data.weight ?? 1.0,
      autoGenerated: data.autoGenerated ?? false,
    })
    .onConflictDoNothing()
    .returning();
  return edge ?? null;
}

/**
 * SECURITY FIX: now requires workspaceId to scope the lookup. Previously this
 * function returned an edge for any (source, target, relationship) tuple
 * regardless of which workspace the caller belonged to — a cross-tenant leak.
 */
export async function getEdgeByNodes(data: {
  workspaceId: string;
  sourceId: string;
  targetId: string;
  relationship: string;
}): Promise<KnowledgeEdge | null> {
  const [edge] = await db
    .select()
    .from(knowledgeEdges)
    .where(
      and(
        eq(knowledgeEdges.workspaceId, data.workspaceId),
        eq(knowledgeEdges.sourceId, data.sourceId),
        eq(knowledgeEdges.targetId, data.targetId),
        eq(knowledgeEdges.relationship, data.relationship)
      )
    )
    .limit(1);
  return edge ?? null;
}

export async function deleteEdge(
  edgeId: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .delete(knowledgeEdges)
    .where(
      and(
        eq(knowledgeEdges.id, edgeId),
        eq(knowledgeEdges.workspaceId, workspaceId)
      )
    )
    .returning({ id: knowledgeEdges.id });
  return result.length > 0;
}

export async function getRelatedNodes(
  nodeId: string,
  workspaceId: string,
  filters?: { relationship?: string }
): Promise<
  { node: KnowledgeNode; edge: KnowledgeEdge; direction: "outgoing" | "incoming" }[]
> {
  const baseEdgeFilter = eq(knowledgeEdges.workspaceId, workspaceId);

  const outgoingConditions = [baseEdgeFilter, eq(knowledgeEdges.sourceId, nodeId)];
  const incomingConditions = [baseEdgeFilter, eq(knowledgeEdges.targetId, nodeId)];

  if (filters?.relationship) {
    outgoingConditions.push(eq(knowledgeEdges.relationship, filters.relationship));
    incomingConditions.push(eq(knowledgeEdges.relationship, filters.relationship));
  }

  const [outgoing, incoming] = await Promise.all([
    db
      .select({ node: knowledgeNodes, edge: knowledgeEdges })
      .from(knowledgeEdges)
      .innerJoin(knowledgeNodes, eq(knowledgeEdges.targetId, knowledgeNodes.id))
      .where(and(...outgoingConditions)),
    db
      .select({ node: knowledgeNodes, edge: knowledgeEdges })
      .from(knowledgeEdges)
      .innerJoin(knowledgeNodes, eq(knowledgeEdges.sourceId, knowledgeNodes.id))
      .where(and(...incomingConditions)),
  ]);

  return [
    ...outgoing.map((r) => ({ ...r, direction: "outgoing" as const })),
    ...incoming.map((r) => ({ ...r, direction: "incoming" as const })),
  ];
}

// ─── Graph Data ───────────────────────────────────────────

export async function getGraphData(workspaceId: string) {
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
      .where(eq(knowledgeNodes.workspaceId, workspaceId)),
    db
      .select({
        id: knowledgeEdges.id,
        sourceId: knowledgeEdges.sourceId,
        targetId: knowledgeEdges.targetId,
        relationship: knowledgeEdges.relationship,
        weight: knowledgeEdges.weight,
      })
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.workspaceId, workspaceId)),
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

// ─── OAuth ────────────────────────────────────────────────

export async function createOAuthClient(data: {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  clientName?: string;
}) {
  const [client] = await db.insert(oauthClients).values(data).returning();
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
  workspaceId: string | null;
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

/**
 * SECURITY FIX: now requires expectedClientId. Previously the lookup returned
 * a row for any client_id given a matching code; the equality check happened
 * after the lookup in the route handler, leaving a window for confused-deputy
 * timing or other side effects. Pushing the check into the WHERE clause
 * makes the row never returned for the wrong client.
 */
export async function getOAuthCode(code: string, expectedClientId: string) {
  const [authCode] = await db
    .select()
    .from(oauthCodes)
    .where(
      and(
        eq(oauthCodes.code, code),
        eq(oauthCodes.clientId, expectedClientId),
        eq(oauthCodes.used, false)
      )
    )
    .limit(1);
  return authCode ?? null;
}

export async function markOAuthCodeUsed(code: string) {
  await db.update(oauthCodes).set({ used: true }).where(eq(oauthCodes.code, code));
}

// ─── Dream Suggestions ────────────────────────────────────

export async function getPendingSuggestions(
  workspaceId: string
): Promise<DreamSuggestion[]> {
  return db
    .select()
    .from(dreamSuggestions)
    .where(
      and(
        eq(dreamSuggestions.workspaceId, workspaceId),
        eq(dreamSuggestions.status, "pending")
      )
    )
    .orderBy(desc(dreamSuggestions.createdAt))
    .limit(50);
}

export async function resolveSuggestion(
  suggestionId: string,
  workspaceId: string,
  action: "accepted" | "dismissed"
): Promise<DreamSuggestion | null> {
  const [suggestion] = await db
    .update(dreamSuggestions)
    .set({ status: action })
    .where(
      and(
        eq(dreamSuggestions.id, suggestionId),
        eq(dreamSuggestions.workspaceId, workspaceId)
      )
    )
    .returning();
  return suggestion ?? null;
}
