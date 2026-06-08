CREATE TABLE IF NOT EXISTS "platform_orgs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "plan" text DEFAULT 'free' NOT NULL,
  "enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "platform_orgs_slug_idx" ON "platform_orgs" ("slug");

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_org_id" uuid NOT NULL REFERENCES "platform_orgs"("id") ON DELETE cascade,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_org_external_idx" ON "tenants" ("platform_org_id","external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_org_slug_idx" ON "tenants" ("platform_org_id","slug");
CREATE INDEX IF NOT EXISTS "tenants_org_idx" ON "tenants" ("platform_org_id");

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'personal' NOT NULL;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "platform_org_id" uuid REFERENCES "platform_orgs"("id") ON DELETE cascade;
CREATE INDEX IF NOT EXISTS "workspaces_platform_org_idx" ON "workspaces" ("platform_org_id");
CREATE INDEX IF NOT EXISTS "workspaces_scope_idx" ON "workspaces" ("scope");
UPDATE "workspaces" SET "scope" = 'personal' WHERE "scope" IS NULL;

CREATE TABLE IF NOT EXISTS "account_api_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_org_id" uuid NOT NULL REFERENCES "platform_orgs"("id") ON DELETE cascade,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "token_prefix" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "scopes" text[] DEFAULT '{"read","write"}'::text[] NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_api_tokens_org_idx" ON "account_api_tokens" ("platform_org_id");
CREATE INDEX IF NOT EXISTS "account_api_tokens_hash_idx" ON "account_api_tokens" ("token_hash");

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_org_id" uuid REFERENCES "platform_orgs"("id") ON DELETE set null,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE set null,
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE set null,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "surface" text NOT NULL,
  "operation" text NOT NULL,
  "via" text DEFAULT 'web' NOT NULL,
  "billable" boolean DEFAULT true NOT NULL,
  "units" integer DEFAULT 1 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "usage_events_org_created_idx" ON "usage_events" ("platform_org_id","created_at");
CREATE INDEX IF NOT EXISTS "usage_events_workspace_created_idx" ON "usage_events" ("workspace_id","created_at");
CREATE INDEX IF NOT EXISTS "usage_events_tenant_created_idx" ON "usage_events" ("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "usage_events_surface_created_idx" ON "usage_events" ("surface","created_at");

CREATE TABLE IF NOT EXISTS "usage_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_org_id" uuid REFERENCES "platform_orgs"("id") ON DELETE cascade,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE cascade,
  "surface" text NOT NULL,
  "operation" text,
  "limit_units" integer,
  "period" text DEFAULT 'monthly' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "knowledge_nodes" ADD COLUMN IF NOT EXISTS "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE set null;
ALTER TABLE "knowledge_edges" ADD COLUMN IF NOT EXISTS "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE set null;
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE set null;
ALTER TABLE "dream_suggestions" ADD COLUMN IF NOT EXISTS "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "knowledge_nodes_workspace_tenant_idx" ON "knowledge_nodes" ("workspace_id","tenant_id");
