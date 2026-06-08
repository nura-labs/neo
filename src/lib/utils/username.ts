import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";

/**
 * Reserved names that cannot be used as a username or workspace slug.
 * Includes routes we use, generic system names, and the brand.
 */
const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "neo",
  "nura",
  "support",
  "www",
  "settings",
  "invite",
  "invites",
  "workspaces",
  "workspace",
  "login",
  "signup",
  "logout",
  "me",
  "you",
  "team",
  "teams",
  "org",
  "orgs",
  "user",
  "users",
  "members",
  "tokens",
  "billing",
  "docs",
  "blog",
  "help",
  "status",
  "system",
  "internal",
  "public",
  "private",
  "graph",
  "knowledge",
  "dashboard",
  "onboarding",
  "null",
  "undefined",
]);

const MAX_LEN = 30;
const MIN_LEN = 3;

/**
 * Derive a base candidate username from a seed (typically email or a name).
 * Lowercases, normalizes accents, strips everything that isn't [a-z0-9],
 * truncates to 30 chars. Returns "user" if nothing usable remains.
 */
export function deriveUsername(seed: string): string {
  const base = seed
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    // strip combining diacritical marks
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, MAX_LEN);
  return base || "user";
}

/**
 * Format-only validation. Caller must also check uniqueness.
 */
export function isValidUsernameFormat(value: string): boolean {
  if (value.length < MIN_LEN || value.length > MAX_LEN) return false;
  if (!/^[a-z0-9-]+$/.test(value)) return false;
  // can't start or end with hyphen, no consecutive hyphens
  if (value.startsWith("-") || value.endsWith("-")) return false;
  if (value.includes("--")) return false;
  return true;
}

export function isReservedName(value: string): boolean {
  return RESERVED.has(value);
}

/**
 * Generate a unique username from a seed. Appends `-2`, `-3`, ... on collision.
 * If the derived base is reserved, suffixes `1` to make it usable
 * (e.g. "admin" -> "admin1", then "admin1-2" if that's also taken).
 */
export async function generateUniqueUsername(seed: string): Promise<string> {
  let base = deriveUsername(seed);
  if (isReservedName(base)) base = `${base}1`;
  // pad too-short bases (e.g. "ab" -> "ab1") to satisfy MIN_LEN
  if (base.length < MIN_LEN) base = `${base}${"1".repeat(MIN_LEN - base.length)}`;

  let candidate = base;
  let i = 2;
  while (true) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${i++}`;
    // safety bound — shouldn't ever hit this in practice
    if (i > 9999) throw new Error(`Could not generate unique username for seed: ${seed}`);
  }
}

/**
 * Workspace-slug-style derivation: like deriveUsername, but preserves
 * dashes between word boundaries so multi-word slugs read naturally
 * (e.g. "Oscar Morales-personal" -> "oscar-morales-personal").
 */
export function deriveWorkspaceSlug(seed: string): string {
  const base = seed
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_LEN)
    .replace(/-+$/g, "");
  return base || "workspace";
}

/**
 * Workspace slug uniqueness. Workspace slugs collide globally (URL-visible),
 * so the same RESERVED set applies.
 */
export async function generateUniqueWorkspaceSlug(seed: string): Promise<string> {
  let base = deriveWorkspaceSlug(seed);
  if (isReservedName(base)) base = `${base}-1`;
  if (base.length < MIN_LEN) base = `${base}${"1".repeat(MIN_LEN - base.length)}`;

  let candidate = base;
  let i = 2;
  while (true) {
    const [existing] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${i++}`;
    if (i > 9999) throw new Error(`Could not generate unique workspace slug for seed: ${seed}`);
  }
}
