import { Command } from "commander";
import { loginViaOAuth } from "../lib/oauth.js";
import {
  DEFAULT_API_URL,
  clearCredentials,
  credentialsPath,
  loadCredentials,
  saveCredentials,
} from "../lib/config.js";
import { apiRequest } from "../lib/api.js";
import { err, info, output, success } from "../lib/output.js";

interface Workspace {
  id: string;
  slug: string;
  name: string;
  plan: string;
  role: "owner" | "member";
}

interface UserInfo {
  user: { id: string; name: string; email: string; username: string };
  workspaces: Workspace[];
}

export function authCommand(): Command {
  const cmd = new Command("auth").description("Authenticate with Neo");

  cmd
    .command("login")
    .description("Open a browser and authorize the CLI")
    .option("--api-url <url>", "Override Neo API URL", DEFAULT_API_URL)
    .action(async (opts: { apiUrl: string }) => {
      const { token, apiUrl } = await loginViaOAuth(opts.apiUrl);

      const wsRes = await apiRequest<{ workspaces: Workspace[] }>(
        "/api/workspaces",
        {},
        {
          apiUrl,
          token,
          workspaceSlug: null,
          workspaceName: null,
          username: null,
          email: null,
          savedAt: new Date().toISOString(),
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
        savedAt: new Date().toISOString(),
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
            role: w.role,
          })),
        },
        () => ""
      );
    });

  cmd
    .command("status")
    .description("Show current auth status")
    .action(async () => {
      const creds = loadCredentials();
      if (!creds) {
        output({ authenticated: false }, () => "Not authenticated");
        return;
      }
      const me = await apiRequest<UserInfo>("/api/workspaces");
      const ok = me.ok;
      output(
        {
          authenticated: ok,
          apiUrl: creds.apiUrl,
          activeWorkspace: creds.workspaceSlug,
          tokenPrefix: creds.token.slice(0, 20) + "…",
          savedAt: creds.savedAt,
        },
        (v) => {
          const d = v as Record<string, unknown>;
          return `authenticated: ${d.authenticated}\napiUrl:         ${d.apiUrl}\nworkspace:      ${d.activeWorkspace}\ntoken:          ${d.tokenPrefix}`;
        }
      );
    });

  cmd
    .command("logout")
    .description("Forget the stored credentials")
    .action(() => {
      clearCredentials();
      success("Logged out");
    });

  return cmd;
}
