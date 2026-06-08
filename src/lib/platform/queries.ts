import { eq, and, desc, sql, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  platformOrgs,
  tenants,
  accountApiTokens,
  usageEvents,
  workspaces,
  memberships,
  users,
  type PlatformOrg,
  type Tenant,
  type AccountApiToken,
  type Workspace,
  type WorkspaceScope,
} from "@/lib/db/schema";
import { generateAccountApiToken, hashToken } from "@/lib/auth/token";
import { generateSlug } from "@/lib/utils/slugify";

export async function getPlatformOrgByUserId(userId: string): Promise<PlatformOrg | null> {
  const [org] = await db
    .select()
    .from(platformOrgs)
    .where(eq(platformOrgs.userId, userId))
    .limit(1);
  return org ?? null;
}

export async function getPlatformOrgById(id: string): Promise<PlatformOrg | null> {
  const [org] = await db.select().from(platformOrgs).where(eq(platformOrgs.id, id)).limit(1);
  return org ?? null;
}

export async function getPlatformOrgBySlug(slug: string): Promise<PlatformOrg | null> {
  const [org] = await db
    .select()
    .from(platformOrgs)
    .where(eq(platformOrgs.slug, slug))
    .limit(1);
  return org ?? null;
}

export async function enablePlatformOrg(data: {
  userId: string;
  name: string;
  slug: string;
}): Promise<PlatformOrg> {
  const existing = await getPlatformOrgByUserId(data.userId);
  if (existing) return existing;

  const [org] = await db
    .insert(platformOrgs)
    .values({
      userId: data.userId,
      name: data.name,
      slug: data.slug,
    })
    .returning();
  return org;
}

export async function getAccountTokenByHash(
  hash: string
): Promise<{ token: AccountApiToken; org: PlatformOrg } | null> {
  const [row] = await db
    .select({ token: accountApiTokens, org: platformOrgs })
    .from(accountApiTokens)
    .innerJoin(platformOrgs, eq(accountApiTokens.platformOrgId, platformOrgs.id))
    .where(and(eq(accountApiTokens.tokenHash, hash), isNull(accountApiTokens.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function touchAccountTokenLastUsed(tokenId: string): Promise<void> {
  await db
    .update(accountApiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(accountApiTokens.id, tokenId));
}

export async function listAccountTokens(platformOrgId: string): Promise<AccountApiToken[]> {
  return db
    .select()
    .from(accountApiTokens)
    .where(
      and(eq(accountApiTokens.platformOrgId, platformOrgId), isNull(accountApiTokens.revokedAt))
    )
    .orderBy(desc(accountApiTokens.createdAt));
}

export async function createAccountToken(data: {
  platformOrgId: string;
  createdByUserId: string;
  name: string;
  scopes?: string[];
}): Promise<{ token: AccountApiToken; plaintext: string }> {
  const { plaintext, prefix, hash } = generateAccountApiToken();
  const [token] = await db
    .insert(accountApiTokens)
    .values({
      platformOrgId: data.platformOrgId,
      createdByUserId: data.createdByUserId,
      name: data.name,
      tokenPrefix: prefix,
      tokenHash: hash,
      scopes: data.scopes ?? ["read", "write"],
    })
    .returning();
  return { token, plaintext };
}

export async function revokeAccountToken(
  platformOrgId: string,
  tokenId: string
): Promise<boolean> {
  const result = await db
    .update(accountApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(accountApiTokens.id, tokenId),
        eq(accountApiTokens.platformOrgId, platformOrgId),
        isNull(accountApiTokens.revokedAt)
      )
    )
    .returning({ id: accountApiTokens.id });
  return result.length > 0;
}

async function uniqueTenantSlug(platformOrgId: string, base: string): Promise<string> {
  const slug = generateSlug(base) || "tenant";
  const existing = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.platformOrgId, platformOrgId));
  const slugs = new Set(existing.map((r) => r.slug));
  if (!slugs.has(slug)) return slug;
  let i = 2;
  while (slugs.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export async function createTenant(data: {
  platformOrgId: string;
  externalId: string;
  name: string;
  slug?: string;
  metadata?: Record<string, unknown>;
}): Promise<Tenant> {
  const slug = data.slug
    ? generateSlug(data.slug) || (await uniqueTenantSlug(data.platformOrgId, data.name))
    : await uniqueTenantSlug(data.platformOrgId, data.name);

  const [tenant] = await db
    .insert(tenants)
    .values({
      platformOrgId: data.platformOrgId,
      externalId: data.externalId,
      name: data.name,
      slug,
      metadata: data.metadata ?? {},
    })
    .returning();
  return tenant;
}

export async function listTenants(
  platformOrgId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ tenants: Tenant[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const where = eq(tenants.platformOrgId, platformOrgId);

  const [rows, countRow] = await Promise.all([
    db.select().from(tenants).where(where).orderBy(desc(tenants.createdAt)).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(where),
  ]);

  return { tenants: rows, total: countRow[0]?.count ?? 0 };
}

export async function getTenantById(
  platformOrgId: string,
  tenantId: string
): Promise<Tenant | null> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.platformOrgId, platformOrgId)))
    .limit(1);
  return tenant ?? null;
}

export async function getTenantByExternalIdOrSlug(
  platformOrgId: string,
  identifier: string
): Promise<Tenant | null> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(
      and(
        eq(tenants.platformOrgId, platformOrgId),
        sql`(${tenants.externalId} = ${identifier} OR ${tenants.slug} = ${identifier})`
      )
    )
    .limit(1);
  return tenant ?? null;
}

export async function updateTenant(
  platformOrgId: string,
  tenantId: string,
  updates: { name?: string; metadata?: Record<string, unknown> }
): Promise<Tenant | null> {
  const [tenant] = await db
    .update(tenants)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(tenants.id, tenantId), eq(tenants.platformOrgId, platformOrgId)))
    .returning();
  return tenant ?? null;
}

export async function deleteTenant(platformOrgId: string, tenantId: string): Promise<boolean> {
  const result = await db
    .delete(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.platformOrgId, platformOrgId)))
    .returning({ id: tenants.id });
  return result.length > 0;
}

export async function createPlatformWorkspace(data: {
  platformOrgId: string;
  createdByUserId: string;
  name: string;
  slug: string;
}): Promise<Workspace> {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      slug: data.slug,
      name: data.name,
      createdByUserId: data.createdByUserId,
      scope: "platform",
      platformOrgId: data.platformOrgId,
    })
    .returning();

  await db.insert(memberships).values({
    workspaceId: workspace.id,
    userId: data.createdByUserId,
    role: "owner",
  });

  return workspace;
}

export async function listPlatformWorkspaces(platformOrgId: string): Promise<Workspace[]> {
  return db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.platformOrgId, platformOrgId), eq(workspaces.scope, "platform"))
    )
    .orderBy(desc(workspaces.createdAt));
}

export async function getPlatformWorkspace(
  platformOrgId: string,
  workspaceId: string
): Promise<Workspace | null> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.platformOrgId, platformOrgId),
        eq(workspaces.scope, "platform")
      )
    )
    .limit(1);
  return ws ?? null;
}

export async function getPlatformWorkspaceBySlug(
  platformOrgId: string,
  slug: string,
  orgUserId?: string
): Promise<Workspace | null> {
  const [platformWs] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(workspaces.platformOrgId, platformOrgId),
        eq(workspaces.scope, "platform")
      )
    )
    .limit(1);

  if (platformWs) return platformWs;

  if (!orgUserId) return null;

  const [memberRow] = await db
    .select({ workspace: workspaces })
    .from(workspaces)
    .innerJoin(memberships, eq(memberships.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(memberships.userId, orgUserId),
        eq(workspaces.scope, "personal")
      )
    )
    .limit(1);

  return memberRow?.workspace ?? null;
}

export async function listWorkspacesByScope(
  userId: string,
  scope: WorkspaceScope
): Promise<Array<Workspace & { role: "owner" | "member" }>> {
  const rows = await db
    .select({ workspace: workspaces, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(and(eq(memberships.userId, userId), eq(workspaces.scope, scope)))
    .orderBy(desc(workspaces.createdAt));

  return rows.map((r) => ({ ...r.workspace, role: r.role as "owner" | "member" }));
}

export interface UsageAggregation {
  period: { start: string; end: string };
  totals: { operations: number; units: number };
  by_operation: Record<string, number>;
  by_via: Record<string, number>;
  by_tenant?: Array<{ id: string; name: string; units: number }>;
  by_workspace?: Array<{ id: string; name: string; units: number }>;
}

function periodStart(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function aggregateUsage(filters: {
  surface?: "personal" | "platform";
  platformOrgId?: string;
  workspaceId?: string;
  tenantId?: string;
  days?: number;
}): Promise<UsageAggregation> {
  const days = filters.days ?? 30;
  const since = periodStart(days);
  const conditions = [gte(usageEvents.createdAt, since)];

  if (filters.surface) conditions.push(eq(usageEvents.surface, filters.surface));
  if (filters.platformOrgId)
    conditions.push(eq(usageEvents.platformOrgId, filters.platformOrgId));
  if (filters.workspaceId) conditions.push(eq(usageEvents.workspaceId, filters.workspaceId));
  if (filters.tenantId) conditions.push(eq(usageEvents.tenantId, filters.tenantId));

  const where = and(...conditions);

  const [totals, byOp, byVia] = await Promise.all([
    db
      .select({
        operations: sql<number>`count(*)::int`,
        units: sql<number>`coalesce(sum(${usageEvents.units}), 0)::int`,
      })
      .from(usageEvents)
      .where(where),
    db
      .select({
        operation: usageEvents.operation,
        units: sql<number>`coalesce(sum(${usageEvents.units}), 0)::int`,
      })
      .from(usageEvents)
      .where(where)
      .groupBy(usageEvents.operation),
    db
      .select({
        via: usageEvents.via,
        units: sql<number>`coalesce(sum(${usageEvents.units}), 0)::int`,
      })
      .from(usageEvents)
      .where(where)
      .groupBy(usageEvents.via),
  ]);

  const result: UsageAggregation = {
    period: { start: since.toISOString(), end: new Date().toISOString() },
    totals: {
      operations: totals[0]?.operations ?? 0,
      units: totals[0]?.units ?? 0,
    },
    by_operation: Object.fromEntries(byOp.map((r) => [r.operation, r.units])),
    by_via: Object.fromEntries(byVia.map((r) => [r.via, r.units])),
  };

  if (filters.platformOrgId && !filters.tenantId) {
    const byTenant = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        units: sql<number>`coalesce(sum(${usageEvents.units}), 0)::int`,
      })
      .from(usageEvents)
      .innerJoin(tenants, eq(usageEvents.tenantId, tenants.id))
      .where(where)
      .groupBy(tenants.id, tenants.name);

    result.by_tenant = byTenant.map((r) => ({
      id: r.id,
      name: r.name,
      units: r.units,
    }));
  }

  return result;
}

export async function getPlatformOwnerUser(org: PlatformOrg) {
  const [user] = await db.select().from(users).where(eq(users.id, org.userId)).limit(1);
  return user ?? null;
}

export { hashToken };
