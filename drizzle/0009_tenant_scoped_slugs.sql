-- Slugs are unique per (workspace, tenant). Personal rows (tenant_id IS NULL)
-- keep workspace-wide slug uniqueness among themselves.
DROP INDEX IF EXISTS "knowledge_nodes_workspace_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_nodes_workspace_slug_personal_idx" ON "knowledge_nodes" USING btree ("workspace_id","slug") WHERE "tenant_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_nodes_workspace_tenant_slug_idx" ON "knowledge_nodes" USING btree ("workspace_id","tenant_id","slug") WHERE "tenant_id" IS NOT NULL;
