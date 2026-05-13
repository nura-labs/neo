import { Command } from "commander";
import { loginViaOAuth } from "../lib/oauth.js";
import {
  DEFAULT_API_URL,
  clearCredentials,
  credentialsPath,
  loadAllCredentials,
  loadCredentials,
  upsertProfile,
} from "../lib/config.js";
import { apiRequest, apiRequestUnauth } from "../lib/api.js";
import { err, info, output, success } from "../lib/output.js";

interface WhoamiResponse {
  workspace: { id: string; slug: string; name: string; plan: string };
  user: { id: string; name: string; email: string; username: string } | null;
  token: { id: string; name: string; tokenPrefix: string; scopes: string[] };
}

export function authCommand(): Command {
  const cmd = new Command("auth").description("Authenticate with Neo");

  cmd
    .command("login")
    .description("Open a browser and authorize the CLI for a workspace")
    .option("--api-url <url>", "Override Neo API URL", DEFAULT_API_URL)
    .action(async (opts: { apiUrl: string }) => {
      const { token, apiUrl, workspace } = await loginViaOAuth(opts.apiUrl);

      // Prefer the workspace returned by /api/token. Fall back to /api/whoami
      // for older server versions (defensive).
      let ws = workspace;
      if (!ws) {
        const me = await apiRequestUnauth<WhoamiResponse>(apiUrl, "/api/whoami", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (me.ok) ws = me.data.workspace;
      }
      if (!ws) err("OAuth succeeded but the server did not return workspace info.");

      // Pull the user identity (best-effort)
      const me = await apiRequestUnauth<WhoamiResponse>(apiUrl, "/api/whoami", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      upsertProfile({
        apiUrl,
        token,
        workspaceSlug: ws.slug,
        workspaceName: ws.name,
        workspacePlan: ws.plan,
        username: me.ok ? me.data.user?.username ?? null : null,
        email: me.ok ? me.data.user?.email ?? null : null,
        savedAt: new Date().toISOString(),
      });

      success(`Signed in. Active workspace: ${ws.name} (${ws.slug})`);
      info(`Credentials saved to ${credentialsPath()}`);
      info(`Add another workspace later with \`neo auth login\` again — \`neo workspace use <slug>\` switches between them.`);
      output(
        {
          status: "ok",
          apiUrl,
          activeWorkspace: { slug: ws.slug, name: ws.name },
        },
        () => ""
      );
    });

  cmd
    .command("status")
    .description("Show current auth status")
    .action(async () => {
      const all = loadAllCredentials();
      const active = loadCredentials();
      if (!active) {
        output({ authenticated: false, profiles: [] }, () => "Not authenticated");
        return;
      }
      const me = await apiRequest<WhoamiResponse>("/api/whoami");
      output(
        {
          authenticated: me.ok,
          apiUrl: active.apiUrl,
          activeWorkspace: active.workspaceSlug,
          tokenPrefix: active.token.slice(0, 20) + "…",
          username: active.username,
          email: active.email,
          savedAt: active.savedAt,
          profiles: Object.keys(all.profiles),
        },
        (v) => {
          const d = v as Record<string, unknown>;
          return [
            `authenticated: ${d.authenticated}`,
            `apiUrl:        ${d.apiUrl}`,
            `workspace:     ${d.activeWorkspace}`,
            `user:          ${d.username ?? "?"} <${d.email ?? "?"}>`,
            `token:         ${d.tokenPrefix}`,
            `profiles:      ${(d.profiles as string[]).join(", ") || "(none)"}`,
          ].join("\n");
        }
      );
    });

  cmd
    .command("logout")
    .description("Forget all stored credentials")
    .action(() => {
      clearCredentials();
      success("Logged out (all profiles cleared)");
    });

  return cmd;
}
