CREATE TABLE "cli_device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_code" text NOT NULL,
	"user_id" uuid,
	"cli_token_id" uuid,
	"api_key_plaintext" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cli_device_sessions_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
CREATE TABLE "cli_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cli_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "cli_device_sessions" ADD CONSTRAINT "cli_device_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_device_sessions" ADD CONSTRAINT "cli_device_sessions_cli_token_id_cli_tokens_id_fk" FOREIGN KEY ("cli_token_id") REFERENCES "public"."cli_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_tokens" ADD CONSTRAINT "cli_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cli_device_sessions_code_idx" ON "cli_device_sessions" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "cli_device_sessions_expires_idx" ON "cli_device_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cli_tokens_user_idx" ON "cli_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cli_tokens_hash_idx" ON "cli_tokens" USING btree ("token_hash");