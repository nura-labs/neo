import type {
  AccountApiToken,
  KnowledgeNode,
  Tenant,
  Workspace,
} from "@/lib/db/schema";

export function serializeWorkspace(workspace: Workspace) {
  return {
    object: "workspace" as const,
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    plan: workspace.plan,
    scope: workspace.scope,
    platform_org_id: workspace.platformOrgId,
    created_at: workspace.createdAt.toISOString(),
    updated_at: workspace.updatedAt.toISOString(),
  };
}

export function serializeTenant(tenant: Tenant) {
  return {
    object: "tenant" as const,
    id: tenant.id,
    external_id: tenant.externalId,
    slug: tenant.slug,
    name: tenant.name,
    metadata: tenant.metadata ?? {},
    created_at: tenant.createdAt.toISOString(),
    updated_at: tenant.updatedAt.toISOString(),
  };
}

export function serializeNode(node: KnowledgeNode) {
  return {
    object: "context_node" as const,
    id: node.id,
    slug: node.slug,
    type: node.type,
    title: node.title,
    content: node.content,
    tags: node.tags,
    source: node.source,
    source_meta: node.sourceMeta ?? {},
    tenant_id: node.tenantId,
    workspace_id: node.workspaceId,
    created_at: node.createdAt.toISOString(),
    updated_at: node.updatedAt.toISOString(),
  };
}

export function serializeAccountKey(token: AccountApiToken) {
  return {
    object: "account_api_key" as const,
    id: token.id,
    name: token.name,
    token_prefix: token.tokenPrefix,
    scopes: token.scopes,
    last_used_at: token.lastUsedAt?.toISOString() ?? null,
    created_at: token.createdAt.toISOString(),
  };
}

export function serializeOrganization(org: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  enabledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    object: "organization" as const,
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    enabled_at: org.enabledAt.toISOString(),
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
  };
}
