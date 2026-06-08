ALTER TABLE "knowledge_nodes" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "knowledge_edges" ADD COLUMN "last_analyzed_at" timestamp with time zone;