import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { apiRequest } from "../lib/api.js";
import { loadCredentials } from "../lib/config.js";
import { colors, err, info, output, success } from "../lib/output.js";

const KNOWN_CLIENTS = [
  "claude-code",
  "cursor",
  "windsurf",
  "vscode",
  "all",
] as const;

interface InstallTarget {
  id: (typeof KNOWN_CLIENTS)[number];
  name: string;
  configPath: string;
  detect: () => boolean;
  install: (entryName: string, url: string, token: string) => void;
}

function targets(): InstallTarget[] {
  const home = homedir();
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      configPath: join(home, ".claude.json"),
      detect: () => existsSync(join(home, ".claude.json")) || existsSync(join(home, ".claude")),
      install(entryName, url, token) {
        const path = join(home, ".claude.json");
        const config = existsSync(path)
          ? (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>)
          : {};
        const servers =
          (config.mcpServers as Record<string, unknown> | undefined) ?? {};
        servers[entryName] = {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` },
        };
        config.mcpServers = servers;
        writeFileSync(path, JSON.stringify(config, null, 2));
      },
    },
    {
      id: "cursor",
      name: "Cursor",
      configPath: join(home, ".cursor", "mcp.json"),
      detect: () => existsSync(join(home, ".cursor")) || existsSync(join(home, "Library/Application Support/Cursor")),
      install(entryName, url, token) {
        const path = join(home, ".cursor", "mcp.json");
        mkdirSync(dirname(path), { recursive: true });
        const config = existsSync(path)
          ? (JSON.parse(readFileSync(path, "utf-8")) as { mcpServers?: Record<string, unknown> })
          : {};
        const servers = config.mcpServers ?? {};
        servers[entryName] = {
          url,
          headers: { Authorization: `Bearer ${token}` },
        };
        config.mcpServers = servers;
        writeFileSync(path, JSON.stringify(config, null, 2));
      },
    },
    {
      id: "windsurf",
      name: "Windsurf",
      configPath: join(home, ".codeium", "windsurf", "mcp_config.json"),
      detect: () => existsSync(join(home, ".codeium", "windsurf")),
      install(entryName, url, token) {
        const path = join(home, ".codeium", "windsurf", "mcp_config.json");
        mkdirSync(dirname(path), { recursive: true });
        const config = existsSync(path)
          ? (JSON.parse(readFileSync(path, "utf-8")) as { mcpServers?: Record<string, unknown> })
          : {};
        const servers = config.mcpServers ?? {};
        servers[entryName] = {
          serverUrl: url,
          headers: { Authorization: `Bearer ${token}` },
        };
        config.mcpServers = servers;
        writeFileSync(path, JSON.stringify(config, null, 2));
      },
    },
    {
      id: "vscode",
      name: "VS Code",
      configPath: join(home, ".vscode", "mcp.json"),
      detect: () =>
        existsSync(join(home, ".vscode")) ||
        existsSync(join(home, "Library/Application Support/Code")),
      install(entryName, url, token) {
        const path = join(home, ".vscode", "mcp.json");
        mkdirSync(dirname(path), { recursive: true });
        const config = existsSync(path)
          ? (JSON.parse(readFileSync(path, "utf-8")) as { servers?: Record<string, unknown> })
          : {};
        const servers = config.servers ?? {};
        servers[entryName] = {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` },
        };
        config.servers = servers;
        writeFileSync(path, JSON.stringify(config, null, 2));
      },
    },
  ];
}

export function mcpCommand(): Command {
  const cmd = new Command("mcp").description("Install Neo MCP into your coding agents");

  cmd
    .command("install [client]")
    .description(`Install MCP. client = ${KNOWN_CLIENTS.join(" | ")} (default: all detected)`)
    .option("--token <token>", "Use a specific token (otherwise mint one for the active workspace)")
    .option("--name <name>", "MCP entry name (default: neo-<workspace-slug>)")
    .action(async (client: string | undefined, opts: { token?: string; name?: string }) => {
      const creds = loadCredentials();
      if (!creds || !creds.workspaceSlug) err("Not authenticated. Run `neo auth login`.");

      // 1) Get a token to use for the MCP server. If --token not provided,
      // mint a fresh "Neo CLI" one for the active workspace.
      let token = opts.token;
      if (!token) {
        info(`Minting a fresh MCP token for workspace ${creds.workspaceSlug}…`);
        const res = await apiRequest<{ plaintext: string }>(
          `/api/workspaces/${creds.workspaceSlug}/tokens`,
          {
            method: "POST",
            body: JSON.stringify({ name: "neo CLI install" }),
          }
        );
        if (!res.ok) err("Failed to mint MCP token. Run `neo token create <name>` manually.");
        token = res.data.plaintext;
      }

      const entryName = opts.name ?? `neo-${creds.workspaceSlug}`;
      const url = `${creds.apiUrl}/api/mcp`;

      // 2) Pick targets
      const allTargets = targets();
      const selected = !client || client === "all"
        ? allTargets.filter((t) => t.detect())
        : allTargets.filter((t) => t.id === client);

      if (selected.length === 0) {
        err(
          !client || client === "all"
            ? "No coding agents detected. Install Claude Code, Cursor, Windsurf, or VS Code first."
            : `Unknown client "${client}". Choose: ${KNOWN_CLIENTS.join(", ")}`
        );
      }

      const results: { client: string; configPath: string; ok: boolean; error?: string }[] = [];
      for (const t of selected) {
        try {
          t.install(entryName, url, token);
          results.push({ client: t.id, configPath: t.configPath, ok: true });
          success(`Configured ${t.name} → ${entryName}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ client: t.id, configPath: t.configPath, ok: false, error: msg });
        }
      }

      info(`Restart your coding agent to pick up the MCP entry "${entryName}".`);
      output({ entryName, url, results }, () => "");
    });

  cmd
    .command("detect")
    .description("List which coding agents are detected on this machine")
    .action(() => {
      const all = targets();
      const detected = all.map((t) => ({
        id: t.id,
        name: t.name,
        configPath: t.configPath,
        installed: t.detect(),
      }));
      output(detected, () =>
        detected
          .map((d) => `${d.installed ? colors.green("✓") : colors.dim("·")} ${d.name.padEnd(14)} ${colors.dim(d.configPath)}`)
          .join("\n")
      );
    });

  return cmd;
}
