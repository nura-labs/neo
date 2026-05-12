#!/usr/bin/env node

// src/wizard.ts
import { spawnSync, spawn } from "child_process";
import pc from "picocolors";
var NEO_PACKAGE = "@nura/neo";
function log(s) {
  process.stderr.write(s + "\n");
}
function header(title) {
  log("");
  log(pc.bold(pc.cyan(`\u258E ${title}`)));
}
function ok(s) {
  log(pc.green("\u2713") + " " + s);
}
function fail(s) {
  log(pc.red("\u2717") + " " + s);
  process.exit(1);
}
function which(bin) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], {
    encoding: "utf-8"
  });
  if (r.status !== 0) return null;
  const out = r.stdout.trim().split("\n")[0]?.trim();
  return out || null;
}
function npmGlobalPrefix() {
  const r = spawnSync("npm", ["prefix", "-g"], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}
async function runStreaming(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["inherit", "inherit", "inherit"] });
    child.on("close", (code) => resolve(code ?? 1));
  });
}
async function main() {
  log("");
  log(pc.bold("Neo wizard") + pc.dim(" \u2014 context engine setup"));
  log(pc.dim("This installs the `neo` CLI globally and connects it to your coding agents."));
  header("Checking environment");
  const nodeVersion = process.version;
  ok(`Node ${nodeVersion}`);
  if (!which("npm")) fail("npm not found. Install Node.js first: https://nodejs.org");
  ok("npm available");
  header(`Installing ${NEO_PACKAGE} globally`);
  const installCode = await runStreaming("npm", ["install", "-g", NEO_PACKAGE + "@latest"]);
  if (installCode !== 0) {
    fail(`npm install failed. Try: sudo npm install -g ${NEO_PACKAGE}`);
  }
  const prefix = npmGlobalPrefix();
  if (prefix) ok(`Installed to ${prefix}`);
  if (!which("neo")) {
    log(pc.yellow("!") + " `neo` not on PATH. Add npm's global bin to PATH:");
    log(pc.dim(`    export PATH="$(npm prefix -g)/bin:$PATH"`));
  } else {
    ok("`neo` is on PATH");
  }
  header("Signing in to Neo");
  log(pc.dim("This opens your browser. Pick the workspace you want to authorize."));
  const loginCode = await runStreaming("neo", ["auth", "login"]);
  if (loginCode !== 0) fail("Login did not complete. Run `neo auth login` to retry.");
  header("Installing MCP into detected coding agents");
  const mcpCode = await runStreaming("neo", ["mcp", "install", "all"]);
  if (mcpCode !== 0) {
    log(pc.yellow("!") + " MCP install reported errors. Run `neo mcp install <client>` manually.");
  }
  header("Done");
  log("Next steps:");
  log(`  ${pc.cyan("neo whoami")}                    ${pc.dim("# confirm active workspace")}`);
  log(`  ${pc.cyan('neo search "auth flow"')}        ${pc.dim("# query your graph")}`);
  log(`  ${pc.cyan('neo add --type note --title "X" --content "..."')}`);
  log(`  ${pc.cyan("neo --agent")}                   ${pc.dim("# print agent-facing usage prompt")}`);
  log("");
  log(pc.dim("Restart Claude Code / Cursor / Windsurf to pick up the new MCP entry."));
  log("");
}
main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
});
