import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  real,
  boolean,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    return JSON.parse(value);
  },
});

// ─── Users ──────────────────────────────────────────────
//
// Post-0006 state: `username` is NOT NULL UNIQUE, `api_token` is dropped
// (replaced by the api_tokens table with sha256 hashing).

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Workspaces ─────────────────────────────────────────
//
// The workspace is the tenant. A user can be a member of many workspaces.
// Solo workspace = 1 member. Shared workspace = 2+.

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    plan: text("plan").notNull().default("free"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("workspaces_created_by_idx").on(table.createdByUserId)]
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'owner' | 'member' (CHECK enforced via app layer for v1)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("memberships_workspace_user_idx").on(table.workspaceId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ]
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(), // 'owner' | 'member'
    token: text("token").notNull().unique(), // URL-safe random, single-shot
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invites_workspace_idx").on(table.workspaceId),
    index("invites_token_idx").on(table.token),
  ]
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // user-supplied label e.g. "MacBook MCP"
    tokenPrefix: text("token_prefix").notNull(), // e.g. "sk-neo-acme-a1b2c3" — display + lookup hint
    tokenHash: text("token_hash").notNull().unique(), // sha256 hex of full token
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`'{"read","write"}'::text[]`),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("api_tokens_workspace_idx").on(table.workspaceId),
    index("api_tokens_hash_idx").on(table.tokenHash),
  ]
);

// ─── CLI Tokens (user-scoped) ───────────────────────────
//
// Separate from api_tokens: api_tokens are bound to ONE workspace (used by MCP
// clients for per-workspace isolation). CLI tokens are bound to a USER and
// grant access to any workspace the user is a member of via the X-Workspace
// header per request. Format: `ncli-{hex64}`. Hashed sha256 like api_tokens.

export const cliTokens = pgTable(
  "cli_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("cli_tokens_user_idx").on(table.userId),
    index("cli_tokens_hash_idx").on(table.tokenHash),
  ]
);

// ─── CLI Device Authorization Sessions ──────────────────
//
// Nia-style device flow. CLI POSTs to /api/cli/device/start which inserts a
// row here with a short user_code (e.g. "ENNA-YASA"). User visits the
// verification URL, signs in, confirms the code. /api/cli/device/exchange
// returns the minted cli_token once `user_id` is filled in by /authorize.

export const cliDeviceSessions = pgTable(
  "cli_device_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userCode: text("user_code").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    cliTokenId: uuid("cli_token_id").references(() => cliTokens.id, {
      onDelete: "cascade",
    }),
    // Plaintext stashed briefly between confirm and exchange. Nulled on consume.
    // (Cloud Run is multi-instance, so an in-process cache wouldn't survive
    // routing — DB is the synchronization point.)
    apiKeyPlaintext: text("api_key_plaintext"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("cli_device_sessions_code_idx").on(table.userCode),
    index("cli_device_sessions_expires_idx").on(table.expiresAt),
  ]
);

export type CliToken = typeof cliTokens.$inferSelect;
export type CliDeviceSession = typeof cliDeviceSessions.$inferSelect;

// ─── Activity Events ────────────────────────────────────
//
// Append-only feed of meaningful workspace events: searches run, nodes
// created/updated, MCP tool calls, etc. Surfaces in Settings → Activity
// and powers the dashboard "what's happening" panel.
//
// type taxonomy (free text for now, will tighten when we add filters):
//   - search           (web or MCP search)
//   - node.create      (a knowledge_node was added)
//   - node.update      (a knowledge_node was edited)
//   - node.delete
//   - edge.create
//   - member.join      (a user accepted an invite or got added)
//   - invite.send
//   - token.create
//   - dream.run        (Dream Cycle ran)
//
// `actor` is the user that did it; `via` records the surface ('web', 'mcp',
// 'cli', 'system') so the UI can show a small badge.

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    via: text("via").notNull().default("web"),
    summary: text("summary").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_events_workspace_idx").on(table.workspaceId, table.createdAt),
    index("activity_events_workspace_type_idx").on(table.workspaceId, table.type),
  ]
);

export type ActivityEvent = typeof activityEvents.$inferSelect;

// ─── Knowledge Graph ────────────────────────────────────
//
// `workspace_id` is added as nullable in migration 0004, backfilled in 0005,
// becomes NOT NULL in 0006. Same for `created_by_user_id`.
// `user_id` stays for now (safety net; dropped in v1.1).
// The unique slug index swaps from (user_id, slug) to (workspace_id, slug) in 0006.

export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // legacy: kept for safety net in v1.0; dropped in v1.1
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    slug: text("slug"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: text("source"),
    sourceMeta: jsonb("source_meta").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_nodes_workspace_idx").on(table.workspaceId),
    index("knowledge_nodes_workspace_type_idx").on(table.workspaceId, table.type),
    index("knowledge_nodes_workspace_source_idx").on(table.workspaceId, table.source),
    uniqueIndex("knowledge_nodes_workspace_slug_idx").on(table.workspaceId, table.slug),
    index("knowledge_nodes_created_by_idx").on(table.createdByUserId),
  ]
);

export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
    weight: real("weight").notNull().default(1.0),
    autoGenerated: boolean("auto_generated").notNull().default(false),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_edges_source_idx").on(table.sourceId),
    index("knowledge_edges_target_idx").on(table.targetId),
    index("knowledge_edges_workspace_idx").on(table.workspaceId),
    uniqueIndex("knowledge_edges_unique_idx").on(
      table.sourceId,
      table.targetId,
      table.relationship
    ),
  ]
);

// ─── OAuth ───────────────────────────────────────────────

export const oauthClients = pgTable("oauth_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  clientSecretExpiresAt: timestamp("client_secret_expires_at", { withTimezone: true }),
  redirectUris: text("redirect_uris")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  clientName: text("client_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const oauthCodes = pgTable("oauth_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }), // nullable for now; locked in at /authorize time when the client picks a workspace
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
  scopes: text("scopes")
    .array()
    .notNull()
    .default(sql`'{"read","write"}'::text[]`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Dream Cycle ────────────────────────────────────────

export const dreamSuggestions = pgTable(
  "dream_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // legacy: kept for safety net in v1.0; dropped in v1.1
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "edge_suggestion" | "contradiction" | "orphan"
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "accepted" | "dismissed"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("dream_suggestions_workspace_idx").on(table.workspaceId)]
);

// ─── Types ───────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type NewKnowledgeNode = typeof knowledgeNodes.$inferInsert;
export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type NewKnowledgeEdge = typeof knowledgeEdges.$inferInsert;
export type DreamSuggestion = typeof dreamSuggestions.$inferSelect;
export type NewDreamSuggestion = typeof dreamSuggestions.$inferInsert;

export type Role = "owner" | "member";
