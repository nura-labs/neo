ALTER TABLE "users" DROP CONSTRAINT "users_api_token_unique";--> statement-breakpoint
DROP INDEX "knowledge_nodes_user_id_idx";--> statement-breakpoint
DROP INDEX "knowledge_nodes_type_idx";--> statement-breakpoint
DROP INDEX "knowledge_nodes_source_idx";--> statement-breakpoint
DROP INDEX "knowledge_nodes_user_slug_idx";--> statement-breakpoint
ALTER TABLE "dream_suggestions" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_edges" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ALTER COLUMN "created_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "dream_suggestions_workspace_idx" ON "dream_suggestions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_edges_workspace_idx" ON "knowledge_edges" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_workspace_idx" ON "knowledge_nodes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_workspace_type_idx" ON "knowledge_nodes" USING btree ("workspace_id","type");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_workspace_source_idx" ON "knowledge_nodes" USING btree ("workspace_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_nodes_workspace_slug_idx" ON "knowledge_nodes" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_created_by_idx" ON "knowledge_nodes" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "api_token";