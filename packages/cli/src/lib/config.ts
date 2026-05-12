import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = process.env.NEO_CONFIG_DIR ?? join(homedir(), ".neo");
const CRED_FILE = join(CONFIG_DIR, "credentials.json");

export interface Credentials {
  apiUrl: string;
  token: string;
  workspaceSlug: string | null;
  workspaceName: string | null;
  username: string | null;
  email: string | null;
  savedAt: string;
}

export const DEFAULT_API_URL =
  process.env.NEO_API_URL ?? "https://neo.nura.sh";

export function loadCredentials(): Credentials | null {
  if (process.env.NEO_TOKEN) {
    return {
      apiUrl: process.env.NEO_API_URL ?? DEFAULT_API_URL,
      token: process.env.NEO_TOKEN,
      workspaceSlug: process.env.NEO_WORKSPACE ?? null,
      workspaceName: null,
      username: null,
      email: null,
      savedAt: new Date().toISOString(),
    };
  }
  if (!existsSync(CRED_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CRED_FILE, "utf-8")) as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2));
  chmodSync(CRED_FILE, 0o600);
}

export function clearCredentials(): void {
  if (!existsSync(CRED_FILE)) return;
  writeFileSync(CRED_FILE, "");
}

export function credentialsPath(): string {
  return CRED_FILE;
}
