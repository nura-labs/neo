import { Command } from "commander";
import { apiRequest } from "../lib/api.js";
import { loadCredentials, saveCredentials } from "../lib/config.js";
import { colors, err, output, success } from "../lib/output.js";

interface Workspace {
  id: string;
  slug: string;
  name: string;
  plan: string;
  role: "owner" | "member";
  memberCount?: number;
}

export function workspaceCommand(): Command {
  const cmd = new Command("workspace")
    .alias("ws")
    .description("List, switch, or create workspaces");

  cmd
    .command("list")
    .description("List workspaces you belong to")
    .action(async () => {
      const res = await apiRequest<{ workspaces: Workspace[] }>("/api/workspaces");
      if (!res.ok) err(`Failed to list workspaces (${res.status})`);
      const creds = loadCredentials();
      output(res.data.workspaces, (v) => {
        const list = v as Workspace[];
        return list
          .map((w) => {
            const active = creds?.workspaceSlug === w.slug ? colors.green("● ") : "  ";
            return `${active}${w.name}  ${colors.dim(`(${w.slug}, ${w.role})`)}`;
          })
          .join("\n");
      });
    });

  cmd
    .command("use <slug>")
    .description("Set the active workspace for subsequent commands")
    .action(async (slug: string) => {
      const res = await apiRequest<{ workspaces: Workspace[] }>("/api/workspaces");
      if (!res.ok) err(`Failed to list workspaces (${res.status})`);
      const target = res.data.workspaces.find((w) => w.slug === slug);
      if (!target) err(`Workspace "${slug}" not found in your memberships`);
      const creds = loadCredentials();
      if (!creds) err("Not authenticated");
      saveCredentials({
        ...creds,
        workspaceSlug: target.slug,
        workspaceName: target.name,
      });
      success(`Active workspace: ${target.name} (${target.slug})`);
    });

  cmd
    .command("create <name>")
    .description("Create a new workspace")
    .option("--slug <slug>", "Custom slug (autoderived from name if omitted)")
    .action(async (name: string, opts: { slug?: string }) => {
      const res = await apiRequest<Workspace>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, slug: opts.slug }),
      });
      if (!res.ok) {
        const errorMsg = (res.data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
        err(`Could not create workspace: ${errorMsg}`);
      }
      const creds = loadCredentials();
      if (creds) {
        saveCredentials({
          ...creds,
          workspaceSlug: res.data.slug,
          workspaceName: res.data.name,
        });
      }
      success(`Created ${res.data.name} (${res.data.slug}) and set as active`);
      output(res.data, () => "");
    });

  return cmd;
}
