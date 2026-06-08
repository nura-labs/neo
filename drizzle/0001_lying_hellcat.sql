CREATE TABLE "dream_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_edges" ADD COLUMN "auto_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "dream_suggestions" ADD CONSTRAINT "dream_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_nodes_user_slug_idx" ON "knowledge_nodes" USING btree ("user_id","slug");