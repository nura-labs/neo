import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { workspaceCommand } from "./commands/workspace.js";
import { addCommand, nodeCommand, overviewCommand, searchCommand } from "./commands/node.js";
import { tokenCommand } from "./commands/token.js";
import { mcpCommand } from "./commands/mcp.js";
import { setGlobalOpts } from "./lib/output.js";
import { loadCredentials } from "./lib/config.js";

const AGENT_PROMPT = `You can call \`neo <command>\` from a shell to operate the user's Neo workspace.

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

const program = new Command();
program
  .name("neo")
  .description("Neo CLI — context engine for individuals and teams")
  .version("0.1.0")
  .option("--json", "Output machine-readable JSON")
  .option("--quiet", "Suppress status messages")
  .option("--verbose", "Print extra diagnostics")
  .option("--agent", "Print agent-facing onboarding prompt and exit")
  .hook("preAction", (cmd) => {
    const opts = cmd.opts() as { json?: boolean; quiet?: boolean; verbose?: boolean };
    setGlobalOpts(opts);
  });

// --agent flag short-circuits everything (Nia-style)
const earlyArgs = process.argv.slice(2);
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

program
  .command("whoami")
  .description("Show the active workspace and user")
  .action(async () => {
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
          tokenPrefix: creds.token.slice(0, 20) + "…",
        },
        null,
        2
      ) + "\n"
    );
  });

program.parseAsync().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
});
