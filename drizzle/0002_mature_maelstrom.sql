CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
CREATE INDEX "knowledge_nodes_embedding_idx" ON "knowledge_nodes" USING hnsw ("embedding" vector_cosine_ops);
