import { Command } from "commander";
import {
  loadAllCredentials,
  loadCredentials,
  removeProfile,
  setActiveSlug,
  upsertProfile,
} from "../lib/config.js";
import { loginViaOAuth } from "../lib/oauth.js";
import { apiRequestUnauth } from "../lib/api.js";
import { colors, err, info, output, success } from "../lib/output.js";

interface WhoamiResponse {
  workspace: { id: string; slug: string; name: string; plan: string };
  user: { id: string; name: string; email: string; username: string } | null;
}

export function workspaceCommand(): Command {
  const cmd = new Command("workspace")
    .alias("ws")
    .description("Manage local workspace profiles (each profile = one OAuth login)");

  cmd
    .command("list")
    .description("List workspaces you've authorized this CLI for")
    .action(() => {
      const creds = loadAllCredentials();
      const profiles = Object.values(creds.profiles);
      output(
        profiles.map((p) => ({
          slug: p.workspaceSlug,
          name: p.workspaceName,
          plan: p.workspacePlan,
          email: p.email,
          active: p.workspaceSlug === creds.activeSlug,
        })),
        (v) => {
          const list = v as { slug: string; name: string | null; active: boolean }[];
          if (list.length === 0)
            return colors.dim("No workspaces authorized. Run `neo auth login`.");
          return list
            .map(
              (p) =>
                `${p.active ? colors.green("● ") : "  "}${p.name ?? p.slug}  ${colors.dim(`(${p.slug})`)}`
            )
            .join("\n");
        }
      );
    });

  cmd
    .command("use <slug>")
    .description("Switch the active workspace among already-authorized profiles")
    .action((slug: string) => {
      const ok = setActiveSlug(slug);
      if (!ok) {
        const creds = loadAllCredentials();
        const known = Object.keys(creds.profiles).join(", ") || "(none)";
        err(
          `No profile for "${slug}". Known profiles: ${known}\nTo authorize a new workspace, run \`neo auth login\` and pick it in the browser.`
        );
      }
      const active = loadCredentials();
      success(`Active workspace: ${active?.workspaceName ?? slug} (${slug})`);
    });

  cmd
    .command("add")
    .description("Authorize this CLI for another workspace (alias of `neo auth login`)")
    .option("--api-url <url>", "Override Neo API URL")
    .action(async (opts: { apiUrl?: string }) => {
      const baseUrl = opts.apiUrl ?? loadCredentials()?.apiUrl ?? "https://neo.nura.sh";
      const { token, apiUrl, workspace } = await loginViaOAuth(baseUrl);
      let ws = workspace;
      if (!ws) {
        const me = await apiRequestUnauth<WhoamiResponse>(apiUrl, "/api/whoami", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (me.ok) ws = me.data.workspace;
      }
      if (!ws) err("OAuth succeeded but server did not return workspace info.");

      upsertProfile({
        apiUrl,
        token,
        workspaceSlug: ws.slug,
        workspaceName: ws.name,
        workspacePlan: ws.plan,
        username: null,
        email: null,
        savedAt: new Date().toISOString(),
      });
      success(`Added profile: ${ws.name} (${ws.slug}) — now active`);
      info(`Switch later with \`neo workspace use <slug>\``);
    });

  cmd
    .command("remove <slug>")
    .description("Forget the stored profile for a workspace")
    .action((slug: string) => {
      const ok = removeProfile(slug);
      if (!ok) err(`No profile for "${slug}"`);
      const remaining = loadCredentials();
      success(`Removed profile ${slug}`);
      if (remaining) info(`Active workspace now: ${remaining.workspaceSlug}`);
      else info(`No active workspace. Run \`neo auth login\`.`);
    });

  cmd
    .command("create <name>")
    .description("Create a NEW workspace on the server (you must already be signed in)")
    .option("--slug <slug>", "Custom slug (autoderived from name if omitted)")
    .action(async (name: string, opts: { slug?: string }) => {
      // Local import to avoid circular: we call /api/workspaces with the
      // active profile's token. This works because /api/workspaces accepts
      // workspace-scoped tokens too — but actually it requires Firebase ID
      // tokens. For now, recommend creating via the web UI.
      err(
        "Creating workspaces from the CLI requires a user-level token. Create a new workspace in the web UI (Settings → switcher → 'New workspace'), then run `neo workspace add` to authorize this CLI for it."
      );
      void name;
      void opts;
    });

  return cmd;
}
