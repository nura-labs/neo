-- Tenant deletion previously set tenant_id to NULL on knowledge_nodes. With
-- per-tenant slug uniqueness, orphaning nodes can violate the personal-slug
-- unique index when another personal or orphaned row already uses the same slug.
ALTER TABLE "knowledge_nodes" DROP CONSTRAINT IF EXISTS "knowledge_nodes_tenant_id_tenants_id_fk";--> statement-breakpoint
ALTER TABLE "knowledge_nodes" DROP CONSTRAINT IF EXISTS "knowledge_nodes_tenant_id_fkey";--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
