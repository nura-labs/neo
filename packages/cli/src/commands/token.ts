import { Command } from "commander";
import { apiRequest } from "../lib/api.js";
import { loadCredentials } from "../lib/config.js";
import { colors, err, output, success } from "../lib/output.js";

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function workspaceSlug(): string {
  const creds = loadCredentials();
  if (!creds || !creds.workspaceSlug) {
    err("No active workspace. Run `neo workspace use <slug>`.");
  }
  return creds.workspaceSlug;
}

export function tokenCommand(): Command {
  const cmd = new Command("token").description("Create, list, or revoke API tokens for the active workspace");

  cmd
    .command("list")
    .description("List API tokens in the active workspace")
    .action(async () => {
      const slug = workspaceSlug();
      const res = await apiRequest<{ tokens: ApiToken[] }>(
        `/api/workspaces/${slug}/tokens`
      );
      if (!res.ok) err(`Failed to list tokens (${res.status})`);
      output(res.data.tokens, (v) => {
        const list = v as ApiToken[];
        if (list.length === 0) return colors.dim("No tokens.");
        return list
          .map(
            (t) =>
              `${colors.bold(t.name)}  ${colors.dim(t.tokenPrefix + "…")}\n  scopes: ${t.scopes.join(",")}  last used: ${t.lastUsedAt ?? "never"}`
          )
          .join("\n");
      });
    });

  cmd
    .command("create <name>")
    .description("Create a new API token. The plaintext is returned ONCE.")
    .action(async (name: string) => {
      const slug = workspaceSlug();
      const res = await apiRequest<{ plaintext: string; token: ApiToken }>(
        `/api/workspaces/${slug}/tokens`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        }
      );
      if (!res.ok) {
        const errorMsg = (res.data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
        err(`Token creation failed: ${errorMsg}`);
      }
      success(`Token "${name}" created. Copy it now — it is not stored.`);
      output(
        { token: res.data.plaintext, id: res.data.token.id, name: res.data.token.name },
        (v) => {
          const d = v as { token: string };
          return d.token;
        }
      );
    });

  cmd
    .command("revoke <id>")
    .description("Revoke an API token by id")
    .action(async (id: string) => {
      const slug = workspaceSlug();
      const res = await apiRequest(`/api/workspaces/${slug}/tokens/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) err(`Revoke failed (${res.status})`);
      success("Token revoked");
    });

  return cmd;
}
