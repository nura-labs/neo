#!/usr/bin/env node

// src/cli.ts
import { Command as Command6 } from "commander";

// src/commands/auth.ts
import { Command } from "commander";

// src/lib/oauth.ts
import { createServer } from "http";
import { createHash, randomBytes } from "crypto";
import open from "open";

// src/lib/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var CONFIG_DIR = process.env.NEO_CONFIG_DIR ?? join(homedir(), ".neo");
var CRED_FILE = join(CONFIG_DIR, "credentials.json");
var DEFAULT_API_URL = process.env.NEO_API_URL ?? "https://neo.nura.sh";
function loadCredentials() {
  if (process.env.NEO_TOKEN) {
    return {
      apiUrl: process.env.NEO_API_URL ?? DEFAULT_API_URL,
      token: process.env.NEO_TOKEN,
      workspaceSlug: process.env.NEO_WORKSPACE ?? null,
      workspaceName: null,
      username: null,
      email: null,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  if (!existsSync(CRED_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CRED_FILE, "utf-8"));
  } catch {
    return null;
  }
}
function saveCredentials(creds) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 448 });
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2));
  chmodSync(CRED_FILE, 384);
}
function clearCredentials() {
  if (!existsSync(CRED_FILE)) return;
  writeFileSync(CRED_FILE, "");
}
function credentialsPath() {
  return CRED_FILE;
}

// src/lib/api.ts
var NotAuthenticatedError = class extends Error {
  constructor() {
    super("Not authenticated. Run `neo auth login`.");
  }
};
function buildHeaders(creds, extra) {
  const headers = {
    Authorization: `Bearer ${creds.token}`,
    Accept: "application/json",
    ...extra
  };
  if (creds.workspaceSlug) headers["X-Workspace"] = creds.workspaceSlug;
  return headers;
}
async function apiRequest(path, options = {}, optsCreds) {
  const creds = optsCreds ?? loadCredentials();
  if (!creds) throw new NotAuthenticatedError();
  const url = path.startsWith("http") ? path : `${creds.apiUrl}${path}`;
  const isJson = options.body && typeof options.body === "string";
  const headers = buildHeaders(creds, {
    ...isJson ? { "Content-Type": "application/json" } : {},
    ...options.headers ?? {}
  });
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
async function apiRequestUnauth(apiUrl, path, options = {}) {
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;
  const headers = {
    Accept: "application/json",
    ...options.headers ?? {}
  };
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// src/lib/output.ts
import pc from "picocolors";
var globalOpts = {};
function setGlobalOpts(opts) {
  globalOpts = opts;
}
function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
function printHuman(text) {
  if (!globalOpts.quiet) process.stdout.write(text + "\n");
}
function output(value, humanFallback) {
  if (globalOpts.json) {
    printJson(value);
    return;
  }
  if (humanFallback) {
    printHuman(humanFallback(value));
    return;
  }
  printHuman(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}
function err(msg, exitCode = 1) {
  if (globalOpts.json) {
    process.stdout.write(JSON.stringify({ error: msg }) + "\n");
  } else {
    process.stderr.write(pc.red(`\u2717 ${msg}
`));
  }
  process.exit(exitCode);
}
function success(msg) {
  if (!globalOpts.json && !globalOpts.quiet) {
    process.stderr.write(pc.green(`\u2713 ${msg}
`));
  }
}
function info(msg) {
  if (!globalOpts.json && !globalOpts.quiet) {
    process.stderr.write(pc.dim(`${msg}
`));
  }
}
var colors = pc;

// src/lib/oauth.ts
function base64url(buf) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function generatePkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
async function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (typeof addr === "object" && addr) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("could not determine free port"));
      }
    });
  });
}
function waitForCallback(port, expectedState, timeoutMs) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end("not found");
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");
      if (errorParam) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(
          `<!doctype html><body style="font-family:system-ui;padding:32px"><h2>Authorization failed</h2><p>${errorParam}</p><p>You can close this tab.</p></body>`
        );
        server.close();
        reject(new Error(`OAuth error: ${errorParam}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(
          `<!doctype html><body style="font-family:system-ui;padding:32px"><h2>Invalid callback</h2><p>Missing code or state mismatch.</p></body>`
        );
        server.close();
        reject(new Error("Invalid OAuth callback (missing code or state mismatch)"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" }).end(
        `<!doctype html><body style="font-family:system-ui;padding:48px;text-align:center;color:#111">
          <h2 style="margin:0 0 12px">You're signed in</h2>
          <p style="color:#666;margin:0">Return to your terminal \u2014 Neo CLI is ready.</p>
          <script>setTimeout(() => window.close(), 1500)</script>
        </body>`
      );
      server.close();
      resolve({ code, state });
    });
    server.listen(port, "127.0.0.1");
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out (5 min)"));
    }, timeoutMs);
  });
}
async function loginViaOAuth(apiUrl) {
  const port = await findFreePort();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const { verifier, challenge } = generatePkce();
  const state = base64url(randomBytes(16));
  info("Registering CLI as an OAuth client\u2026");
  const regRes = await apiRequestUnauth(apiUrl, "/api/register", {
    method: "POST",
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: "Neo CLI",
      grant_types: ["authorization_code"],
      response_types: ["code"]
    })
  });
  if (!regRes.ok) {
    err(`Failed to register OAuth client (${regRes.status})`);
  }
  const clientId = regRes.data.client_id;
  const authUrl = new URL("/authorize", apiUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  info(`Opening browser to ${authUrl.origin}/authorize`);
  info(`If it doesn't open, visit: ${authUrl.toString()}`);
  open(authUrl.toString()).catch(() => {
  });
  const { code } = await waitForCallback(port, state, 5 * 6e4);
  info("Exchanging authorization code for API token\u2026");
  const tokenRes = await apiRequestUnauth(apiUrl, "/api/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: redirectUri
    }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  if (!tokenRes.ok) {
    const description = tokenRes.data?.error_description ?? tokenRes.data?.error ?? `HTTP ${tokenRes.status}`;
    err(`Token exchange failed: ${description}`);
  }
  return { token: tokenRes.data.access_token, apiUrl };
}

// src/commands/auth.ts
function authCommand() {
  const cmd = new Command("auth").description("Authenticate with Neo");
  cmd.command("login").description("Open a browser and authorize the CLI").option("--api-url <url>", "Override Neo API URL", DEFAULT_API_URL).action(async (opts) => {
    const { token, apiUrl } = await loginViaOAuth(opts.apiUrl);
    const wsRes = await apiRequest(
      "/api/workspaces",
      {},
      {
        apiUrl,
        token,
        workspaceSlug: null,
        workspaceName: null,
        username: null,
        email: null,
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    );
    if (!wsRes.ok) {
      err(`Could not list workspaces after login (status ${wsRes.status})`);
    }
    const first = wsRes.data.workspaces[0];
    if (!first) {
      err("No workspaces found for this account.");
    }
    saveCredentials({
      apiUrl,
      token,
      workspaceSlug: first.slug,
      workspaceName: first.name,
      username: null,
      email: null,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    success(`Signed in. Active workspace: ${first.name} (${first.slug})`);
    info(`Credentials saved to ${credentialsPath()}`);
    output(
      {
        status: "ok",
        apiUrl,
        activeWorkspace: { slug: first.slug, name: first.name },
        workspaces: wsRes.data.workspaces.map((w) => ({
          slug: w.slug,
          name: w.name,
          role: w.role
        }))
      },
      () => ""
    );
  });
  cmd.command("status").description("Show current auth status").action(async () => {
    const creds = loadCredentials();
    if (!creds) {
      output({ authenticated: false }, () => "Not authenticated");
      return;
    }
    const me = await apiRequest("/api/workspaces");
    const ok = me.ok;
    output(
      {
        authenticated: ok,
        apiUrl: creds.apiUrl,
        activeWorkspace: creds.workspaceSlug,
        tokenPrefix: creds.token.slice(0, 20) + "\u2026",
        savedAt: creds.savedAt
      },
      (v) => {
        const d = v;
        return `authenticated: ${d.authenticated}
apiUrl:         ${d.apiUrl}
workspace:      ${d.activeWorkspace}
token:          ${d.tokenPrefix}`;
      }
    );
  });
  cmd.command("logout").description("Forget the stored credentials").action(() => {
    clearCredentials();
    success("Logged out");
  });
  return cmd;
}

// src/commands/workspace.ts
import { Command as Command2 } from "commander";
function workspaceCommand() {
  const cmd = new Command2("workspace").alias("ws").description("List, switch, or create workspaces");
  cmd.command("list").description("List workspaces you belong to").action(async () => {
    const res = await apiRequest("/api/workspaces");
    if (!res.ok) err(`Failed to list workspaces (${res.status})`);
    const creds = loadCredentials();
    output(res.data.workspaces, (v) => {
      const list = v;
      return list.map((w) => {
        const active = creds?.workspaceSlug === w.slug ? colors.green("\u25CF ") : "  ";
        return `${active}${w.name}  ${colors.dim(`(${w.slug}, ${w.role})`)}`;
      }).join("\n");
    });
  });
  cmd.command("use <slug>").description("Set the active workspace for subsequent commands").action(async (slug) => {
    const res = await apiRequest("/api/workspaces");
    if (!res.ok) err(`Failed to list workspaces (${res.status})`);
    const target = res.data.workspaces.find((w) => w.slug === slug);
    if (!target) err(`Workspace "${slug}" not found in your memberships`);
    const creds = loadCredentials();
    if (!creds) err("Not authenticated");
    saveCredentials({
      ...creds,
      workspaceSlug: target.slug,
      workspaceName: target.name
    });
    success(`Active workspace: ${target.name} (${target.slug})`);
  });
  cmd.command("create <name>").description("Create a new workspace").option("--slug <slug>", "Custom slug (autoderived from name if omitted)").action(async (name, opts) => {
    const res = await apiRequest("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, slug: opts.slug })
    });
    if (!res.ok) {
      const errorMsg = res.data?.error ?? `HTTP ${res.status}`;
      err(`Could not create workspace: ${errorMsg}`);
    }
    const creds = loadCredentials();
    if (creds) {
      saveCredentials({
        ...creds,
        workspaceSlug: res.data.slug,
        workspaceName: res.data.name
      });
    }
    success(`Created ${res.data.name} (${res.data.slug}) and set as active`);
    output(res.data, () => "");
  });
  return cmd;
}

// src/commands/node.ts
import { Command as Command3 } from "commander";
import { readFileSync as readFileSync2 } from "fs";
var NODE_TYPES = [
  "pattern",
  "convention",
  "architecture",
  "decision",
  "concept",
  "workflow",
  "snippet",
  "module",
  "api",
  "service",
  "config",
  "person",
  "project",
  "team",
  "tool",
  "reference",
  "research",
  "note"
];
async function readBodyContent(opts) {
  if (opts.content) return opts.content;
  if (opts.contentFile) return readFileSync2(opts.contentFile, "utf-8");
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (chunk) => data += chunk);
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  }
  return "";
}
function addCommand() {
  return new Command3("add").description("Add a knowledge node (content via --content, --content-file, or stdin)").requiredOption("--type <type>", `Node type (${NODE_TYPES.join("|")})`).requiredOption("--title <title>", "Node title").option("--content <text>", "Content (or pipe via stdin)").option("--content-file <path>", "Read content from file").option("--tags <tag,tag>", "Comma-separated tags").option("--source <source>", "Source identifier (e.g. github:org/repo)").action(async (opts) => {
    if (!NODE_TYPES.includes(opts.type)) {
      err(`Invalid --type. Must be one of: ${NODE_TYPES.join(", ")}`);
    }
    const content = await readBodyContent(opts);
    if (!content.trim()) err("Empty content. Pass --content, --content-file, or pipe stdin.");
    const tags = opts.tags ? opts.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const res = await apiRequest("/api/knowledge", {
      method: "POST",
      body: JSON.stringify({
        type: opts.type,
        title: opts.title,
        content,
        tags,
        source: opts.source
      })
    });
    if (!res.ok) {
      const errorMsg = res.data?.error ?? `HTTP ${res.status}`;
      err(`Failed to create node: ${errorMsg}`);
    }
    success(`Created ${res.data.title} (${res.data.slug})`);
    output(res.data, (v) => {
      const n = v;
      return `slug:  ${n.slug}
type:  ${n.type}
title: ${n.title}`;
    });
  });
}
function searchCommand() {
  return new Command3("search").description("Hybrid search across your knowledge graph").argument("<query>", "Search query").option("--type <type>", "Filter by node type").option("--source <source>", "Filter by source").option("--tags <tag,tag>", "Filter by tags (comma-separated)").option("--limit <n>", "Max results", "20").action(async (query, opts) => {
    const params = new URLSearchParams({ q: query });
    if (opts.type) params.set("type", opts.type);
    if (opts.source) params.set("source", opts.source);
    if (opts.tags) params.set("tags", opts.tags);
    const res = await apiRequest(
      `/api/knowledge/search?${params.toString()}`
    );
    if (!res.ok) err(`Search failed (${res.status})`);
    const max = parseInt(opts.limit, 10) || 20;
    const hits = res.data.nodes.slice(0, max);
    output(hits, () => {
      if (hits.length === 0) return colors.dim(`No matches for "${query}"`);
      return hits.map(
        (n) => `${colors.bold(n.title)} ${colors.dim(`(${n.type}, ${n.slug})`)}
${n.content.slice(0, 240).trim()}${n.content.length > 240 ? "\u2026" : ""}`
      ).join("\n\n");
    });
  });
}
function nodeCommand() {
  const cmd = new Command3("node").description("Get, update, or delete a knowledge node");
  cmd.command("get <slug>").description("Show a node's full content").action(async (slug) => {
    const res = await apiRequest(`/api/knowledge/by-slug/${slug}`);
    if (!res.ok) err(`Node not found: ${slug}`);
    output(res.data, (v) => {
      const n = v;
      return `# ${n.title}
${colors.dim(`type: ${n.type} | slug: ${n.slug} | source: ${n.source ?? "\u2014"}`)}

${n.content}`;
    });
  });
  cmd.command("update <slug>").description("Update a node's title/content/tags").option("--title <title>", "New title").option("--content <text>", "New content (or pipe stdin)").option("--content-file <path>", "Read content from file").option("--tags <tag,tag>", "New tags (replaces existing)").option("--type <type>", "New type").action(async (slug, opts) => {
    const lookup = await apiRequest(`/api/knowledge/by-slug/${slug}`);
    if (!lookup.ok) err(`Node not found: ${slug}`);
    const body = {};
    if (opts.title) body.title = opts.title;
    if (opts.type) body.type = opts.type;
    if (opts.tags !== void 0) {
      body.tags = opts.tags.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const content = await readBodyContent(opts);
    if (content) body.content = content;
    const res = await apiRequest(`/api/knowledge/${lookup.data.id}`, {
      method: "PUT",
      body: JSON.stringify(body)
    });
    if (!res.ok) err(`Update failed (${res.status})`);
    success(`Updated ${res.data.title} (${res.data.slug})`);
    output(res.data, () => "");
  });
  cmd.command("delete <slug>").description("Delete a knowledge node").action(async (slug) => {
    const lookup = await apiRequest(`/api/knowledge/by-slug/${slug}`);
    if (!lookup.ok) err(`Node not found: ${slug}`);
    const res = await apiRequest(`/api/knowledge/${lookup.data.id}`, { method: "DELETE" });
    if (!res.ok) err(`Delete failed (${res.status})`);
    success(`Deleted ${slug}`);
  });
  return cmd;
}
function overviewCommand() {
  return new Command3("overview").description("Show workspace overview (counts + recent)").action(async () => {
    const res = await apiRequest("/api/knowledge/overview");
    if (!res.ok) err(`Overview failed (${res.status})`);
    output(res.data, (v) => {
      const d = v;
      const lines = [
        `${colors.bold("Workspace overview")}`,
        `  nodes:  ${d.totalNodes}`,
        `  edges:  ${d.totalEdges}`,
        ``,
        colors.dim("by type:"),
        ...d.typeBreakdown.map((t) => `  ${t.type.padEnd(14)} ${t.count}`),
        ``,
        colors.dim("recent:"),
        ...d.recentNodes.slice(0, 8).map((n) => `  ${n.title} ${colors.dim(`(${n.type})`)}`)
      ];
      return lines.join("\n");
    });
  });
}

// src/commands/token.ts
import { Command as Command4 } from "commander";
function workspaceSlug() {
  const creds = loadCredentials();
  if (!creds || !creds.workspaceSlug) {
    err("No active workspace. Run `neo workspace use <slug>`.");
  }
  return creds.workspaceSlug;
}
function tokenCommand() {
  const cmd = new Command4("token").description("Create, list, or revoke API tokens for the active workspace");
  cmd.command("list").description("List API tokens in the active workspace").action(async () => {
    const slug = workspaceSlug();
    const res = await apiRequest(
      `/api/workspaces/${slug}/tokens`
    );
    if (!res.ok) err(`Failed to list tokens (${res.status})`);
    output(res.data.tokens, (v) => {
      const list = v;
      if (list.length === 0) return colors.dim("No tokens.");
      return list.map(
        (t) => `${colors.bold(t.name)}  ${colors.dim(t.tokenPrefix + "\u2026")}
  scopes: ${t.scopes.join(",")}  last used: ${t.lastUsedAt ?? "never"}`
      ).join("\n");
    });
  });
  cmd.command("create <name>").description("Create a new API token. The plaintext is returned ONCE.").action(async (name) => {
    const slug = workspaceSlug();
    const res = await apiRequest(
      `/api/workspaces/${slug}/tokens`,
      {
        method: "POST",
        body: JSON.stringify({ name })
      }
    );
    if (!res.ok) {
      const errorMsg = res.data?.error ?? `HTTP ${res.status}`;
      err(`Token creation failed: ${errorMsg}`);
    }
    success(`Token "${name}" created. Copy it now \u2014 it is not stored.`);
    output(
      { token: res.data.plaintext, id: res.data.token.id, name: res.data.token.name },
      (v) => {
        const d = v;
        return d.token;
      }
    );
  });
  cmd.command("revoke <id>").description("Revoke an API token by id").action(async (id) => {
    const slug = workspaceSlug();
    const res = await apiRequest(`/api/workspaces/${slug}/tokens/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) err(`Revoke failed (${res.status})`);
    success("Token revoked");
  });
  return cmd;
}

// src/commands/mcp.ts
import { Command as Command5 } from "commander";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
import { homedir as homedir2 } from "os";
import { join as join2, dirname } from "path";
var KNOWN_CLIENTS = [
  "claude-code",
  "cursor",
  "windsurf",
  "vscode",
  "all"
];
function targets() {
  const home = homedir2();
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      configPath: join2(home, ".claude.json"),
      detect: () => existsSync2(join2(home, ".claude.json")) || existsSync2(join2(home, ".claude")),
      install(entryName, url, token) {
        const path = join2(home, ".claude.json");
        const config = existsSync2(path) ? JSON.parse(readFileSync3(path, "utf-8")) : {};
        const servers = config.mcpServers ?? {};
        servers[entryName] = {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` }
        };
        config.mcpServers = servers;
        writeFileSync2(path, JSON.stringify(config, null, 2));
      }
    },
    {
      id: "cursor",
      name: "Cursor",
      configPath: join2(home, ".cursor", "mcp.json"),
      detect: () => existsSync2(join2(home, ".cursor")) || existsSync2(join2(home, "Library/Application Support/Cursor")),
      install(entryName, url, token) {
        const path = join2(home, ".cursor", "mcp.json");
        mkdirSync2(dirname(path), { recursive: true });
        const config = existsSync2(path) ? JSON.parse(readFileSync3(path, "utf-8")) : {};
        const servers = config.mcpServers ?? {};
        servers[entryName] = {
          url,
          headers: { Authorization: `Bearer ${token}` }
        };
        config.mcpServers = servers;
        writeFileSync2(path, JSON.stringify(config, null, 2));
      }
    },
    {
      id: "windsurf",
      name: "Windsurf",
      configPath: join2(home, ".codeium", "windsurf", "mcp_config.json"),
      detect: () => existsSync2(join2(home, ".codeium", "windsurf")),
      install(entryName, url, token) {
        const path = join2(home, ".codeium", "windsurf", "mcp_config.json");
        mkdirSync2(dirname(path), { recursive: true });
        const config = existsSync2(path) ? JSON.parse(readFileSync3(path, "utf-8")) : {};
        const servers = config.mcpServers ?? {};
        servers[entryName] = {
          serverUrl: url,
          headers: { Authorization: `Bearer ${token}` }
        };
        config.mcpServers = servers;
        writeFileSync2(path, JSON.stringify(config, null, 2));
      }
    },
    {
      id: "vscode",
      name: "VS Code",
      configPath: join2(home, ".vscode", "mcp.json"),
      detect: () => existsSync2(join2(home, ".vscode")) || existsSync2(join2(home, "Library/Application Support/Code")),
      install(entryName, url, token) {
        const path = join2(home, ".vscode", "mcp.json");
        mkdirSync2(dirname(path), { recursive: true });
        const config = existsSync2(path) ? JSON.parse(readFileSync3(path, "utf-8")) : {};
        const servers = config.servers ?? {};
        servers[entryName] = {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` }
        };
        config.servers = servers;
        writeFileSync2(path, JSON.stringify(config, null, 2));
      }
    }
  ];
}
function mcpCommand() {
  const cmd = new Command5("mcp").description("Install Neo MCP into your coding agents");
  cmd.command("install [client]").description(`Install MCP. client = ${KNOWN_CLIENTS.join(" | ")} (default: all detected)`).option("--token <token>", "Use a specific token (otherwise mint one for the active workspace)").option("--name <name>", "MCP entry name (default: neo-<workspace-slug>)").action(async (client, opts) => {
    const creds = loadCredentials();
    if (!creds || !creds.workspaceSlug) err("Not authenticated. Run `neo auth login`.");
    let token = opts.token;
    if (!token) {
      info(`Minting a fresh MCP token for workspace ${creds.workspaceSlug}\u2026`);
      const res = await apiRequest(
        `/api/workspaces/${creds.workspaceSlug}/tokens`,
        {
          method: "POST",
          body: JSON.stringify({ name: "neo CLI install" })
        }
      );
      if (!res.ok) err("Failed to mint MCP token. Run `neo token create <name>` manually.");
      token = res.data.plaintext;
    }
    const entryName = opts.name ?? `neo-${creds.workspaceSlug}`;
    const url = `${creds.apiUrl}/api/mcp`;
    const allTargets = targets();
    const selected = !client || client === "all" ? allTargets.filter((t) => t.detect()) : allTargets.filter((t) => t.id === client);
    if (selected.length === 0) {
      err(
        !client || client === "all" ? "No coding agents detected. Install Claude Code, Cursor, Windsurf, or VS Code first." : `Unknown client "${client}". Choose: ${KNOWN_CLIENTS.join(", ")}`
      );
    }
    const results = [];
    for (const t of selected) {
      try {
        t.install(entryName, url, token);
        results.push({ client: t.id, configPath: t.configPath, ok: true });
        success(`Configured ${t.name} \u2192 ${entryName}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ client: t.id, configPath: t.configPath, ok: false, error: msg });
      }
    }
    info(`Restart your coding agent to pick up the MCP entry "${entryName}".`);
    output({ entryName, url, results }, () => "");
  });
  cmd.command("detect").description("List which coding agents are detected on this machine").action(() => {
    const all = targets();
    const detected = all.map((t) => ({
      id: t.id,
      name: t.name,
      configPath: t.configPath,
      installed: t.detect()
    }));
    output(
      detected,
      () => detected.map((d) => `${d.installed ? colors.green("\u2713") : colors.dim("\xB7")} ${d.name.padEnd(14)} ${colors.dim(d.configPath)}`).join("\n")
    );
  });
  return cmd;
}

// src/cli.ts
var AGENT_PROMPT = `You can call \`neo <command>\` from a shell to operate the user's Neo workspace.

CORE COMMANDS:
  neo auth login                            # one-time browser sign-in
  neo whoami                                # confirm active workspace
  neo workspace list                        # see all workspaces
  neo workspace use <slug>                  # switch active

KNOWLEDGE:
  neo add --type <type> --title "X" --content "..."     # create node
  neo add --type note < notes.md                        # read content from stdin
  neo search "<query>" --json               # JSON results, parseable
  neo node get <slug>                       # full content
  neo node update <slug> --content "..."
  neo node delete <slug>
  neo overview --json                       # workspace counts

TOKENS:
  neo token create "<name>"                 # plaintext shown ONCE
  neo token list --json
  neo token revoke <id>

MCP INSTALL (one-shot):
  neo mcp install --all                     # auto-detect Claude Code, Cursor, etc.
  neo mcp install claude-code

ALL COMMANDS support --json for machine output. Run \`neo <cmd> --help\` for details.
TYPES: pattern convention architecture decision concept workflow snippet module api service config person project team tool reference research note`;
var program = new Command6();
program.name("neo").description("Neo CLI \u2014 context engine for individuals and teams").version("0.1.0").option("--json", "Output machine-readable JSON").option("--quiet", "Suppress status messages").option("--verbose", "Print extra diagnostics").option("--agent", "Print agent-facing onboarding prompt and exit").hook("preAction", (cmd) => {
  const opts = cmd.opts();
  setGlobalOpts(opts);
});
var earlyArgs = process.argv.slice(2);
if (earlyArgs.includes("--agent")) {
  process.stdout.write(AGENT_PROMPT + "\n");
  process.exit(0);
}
program.addCommand(authCommand());
program.addCommand(workspaceCommand());
program.addCommand(addCommand());
program.addCommand(searchCommand());
program.addCommand(nodeCommand());
program.addCommand(overviewCommand());
program.addCommand(tokenCommand());
program.addCommand(mcpCommand());
program.command("whoami").description("Show the active workspace and user").action(async () => {
  const creds = loadCredentials();
  if (!creds) {
    process.stdout.write("Not authenticated\n");
    process.exit(1);
  }
  process.stdout.write(
    JSON.stringify(
      {
        apiUrl: creds.apiUrl,
        workspace: creds.workspaceSlug,
        tokenPrefix: creds.token.slice(0, 20) + "\u2026"
      },
      null,
      2
    ) + "\n"
  );
});
program.parseAsync().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`\u2717 ${msg}
`);
  process.exit(1);
});
