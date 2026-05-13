import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = process.env.NEO_CONFIG_DIR ?? join(homedir(), ".neo");
const CRED_FILE = join(CONFIG_DIR, "credentials.json");

export const DEFAULT_API_URL =
  process.env.NEO_API_URL ?? "https://neo.nura.sh";

/**
 * One stored credential per workspace. Reading happens with
 * `loadCredentials()` which picks the active profile; commands that need
 * something specific (e.g. `workspace use <slug>`) can talk to the
 * profiles map directly.
 */
export interface Profile {
  apiUrl: string;
  token: string;
  workspaceSlug: string;
  workspaceName: string | null;
  workspacePlan?: string;
  username: string | null;
  email: string | null;
  savedAt: string;
}

export interface Credentials {
  activeSlug: string | null;
  profiles: Record<string, Profile>;
}

interface LegacyCredentials {
  apiUrl: string;
  token: string;
  workspaceSlug: string | null;
  workspaceName: string | null;
  username: string | null;
  email: string | null;
  savedAt: string;
}

function isLegacyShape(raw: unknown): raw is LegacyCredentials {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "token" in raw &&
    "profiles" in raw === false
  );
}

function readRaw(): Credentials | null {
  if (!existsSync(CRED_FILE)) return null;
  try {
    const txt = readFileSync(CRED_FILE, "utf-8").trim();
    if (!txt) return null;
    const parsed = JSON.parse(txt) as unknown;

    if (isLegacyShape(parsed)) {
      const legacy = parsed;
      if (!legacy.workspaceSlug) return null;
      return {
        activeSlug: legacy.workspaceSlug,
        profiles: {
          [legacy.workspaceSlug]: {
            apiUrl: legacy.apiUrl,
            token: legacy.token,
            workspaceSlug: legacy.workspaceSlug,
            workspaceName: legacy.workspaceName,
            username: legacy.username,
            email: legacy.email,
            savedAt: legacy.savedAt,
          },
        },
      };
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "profiles" in parsed
    ) {
      return parsed as Credentials;
    }
    return null;
  } catch {
    return null;
  }
}

function ensureDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export function loadAllCredentials(): Credentials {
  if (process.env.NEO_TOKEN) {
    const slug = process.env.NEO_WORKSPACE ?? "env";
    return {
      activeSlug: slug,
      profiles: {
        [slug]: {
          apiUrl: process.env.NEO_API_URL ?? DEFAULT_API_URL,
          token: process.env.NEO_TOKEN,
          workspaceSlug: slug,
          workspaceName: null,
          username: null,
          email: null,
          savedAt: new Date().toISOString(),
        },
      },
    };
  }
  return readRaw() ?? { activeSlug: null, profiles: {} };
}

export function loadCredentials(): Profile | null {
  const all = loadAllCredentials();
  if (!all.activeSlug) return null;
  return all.profiles[all.activeSlug] ?? null;
}

export function writeAllCredentials(creds: Credentials): void {
  ensureDir();
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2));
  chmodSync(CRED_FILE, 0o600);
}

/**
 * Add or replace a profile for the given workspace, mark it active.
 */
export function upsertProfile(p: Profile): void {
  const creds = loadAllCredentials();
  creds.profiles[p.workspaceSlug] = p;
  creds.activeSlug = p.workspaceSlug;
  writeAllCredentials(creds);
}

export function setActiveSlug(slug: string): boolean {
  const creds = loadAllCredentials();
  if (!creds.profiles[slug]) return false;
  creds.activeSlug = slug;
  writeAllCredentials(creds);
  return true;
}

export function removeProfile(slug: string): boolean {
  const creds = loadAllCredentials();
  if (!creds.profiles[slug]) return false;
  delete creds.profiles[slug];
  if (creds.activeSlug === slug) {
    const remaining = Object.keys(creds.profiles);
    creds.activeSlug = remaining[0] ?? null;
  }
  writeAllCredentials(creds);
  return true;
}

export function clearCredentials(): void {
  if (!existsSync(CRED_FILE)) return;
  writeFileSync(CRED_FILE, "");
}

export function credentialsPath(): string {
  return CRED_FILE;
}
