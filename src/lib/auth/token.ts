import { createHash, randomBytes } from "crypto";

/**
 * API token format: `sk-neo-{workspace_slug}-{32 hex chars}`
 *
 * The token is hashed (SHA-256) before being stored in the database. The
 * plaintext is shown ONCE on creation and cannot be retrieved later.
 *
 * The `prefix` is what's shown in the dashboard token list (e.g.
 * "sk-neo-acme-a1b2c3"). It's also the lookup hint used to locate
 * which row to verify the hash against — but the actual auth check is
 * always against the full `tokenHash`.
 */

const HEX_LENGTH = 32; // bytes of randomness in hex form

export interface GeneratedToken {
  /** Full plaintext, e.g. "sk-neo-acme-a1b2c3d4e5f6..." — show ONCE, never store */
  plaintext: string;
  /** Display prefix, e.g. "sk-neo-acme-a1b2c3" — safe to store + show */
  prefix: string;
  /** SHA-256 hex hash, e.g. "a1b2c3..." — what gets stored */
  hash: string;
}

/**
 * Generate a fresh API token scoped to a workspace.
 * The plaintext can be returned to the user once; the hash is what we store.
 */
export function generateApiToken(workspaceSlug: string): GeneratedToken {
  const random = randomBytes(HEX_LENGTH).toString("hex");
  const plaintext = `sk-neo-${workspaceSlug}-${random}`;
  // Display prefix: workspace slug visible, plus 6 chars of randomness for distinguishing
  // between multiple tokens on the same workspace.
  const prefix = `sk-neo-${workspaceSlug}-${random.slice(0, 6)}`;
  const hash = hashToken(plaintext);
  return { plaintext, prefix, hash };
}

/**
 * Hash a plaintext token. Uses SHA-256, hex-encoded.
 */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Generate a one-shot URL-safe token (e.g. invite tokens).
 * Not hashed — invite tokens are short-lived and stored plaintext for direct lookup.
 */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * CLI token format: `ncli-{64 hex chars}` (user-scoped, not workspace-scoped).
 * Used by the Neo CLI: one token, switch workspaces per-request via X-Workspace.
 */
export function generateCliToken(): GeneratedToken {
  const random = randomBytes(32).toString("hex");
  const plaintext = `ncli-${random}`;
  const prefix = `ncli-${random.slice(0, 8)}`;
  const hash = hashToken(plaintext);
  return { plaintext, prefix, hash };
}

/**
 * Short, human-friendly device-flow code: 4-4 chars from an unambiguous alphabet.
 * Example: "ENNA-YASA". Looks tidy on a TTY and can be typed in a browser if open()
 * fails.
 */
export function generateDeviceUserCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
    if (i === 3) out += "-";
  }
  return out;
}
