import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import open from "open";
import { apiRequestUnauth } from "./api.js";
import { info, err } from "./output.js";

interface ClientRegistration {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  workspace?: {
    id: string;
    slug: string;
    name: string;
    plan: string;
  };
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function generatePkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function findFreePort(): Promise<number> {
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

interface CallbackResult {
  code: string;
  state: string;
}

function waitForCallback(
  port: number,
  expectedState: string,
  timeoutMs: number
): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end("not found");
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");

      if (errorParam) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end(
          `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:32px"><h2>Authorization failed</h2><p>${errorParam}</p><p>You can close this tab.</p></body></html>`
        );
        server.close();
        reject(new Error(`OAuth error: ${errorParam}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end(
          `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:32px"><h2>Invalid callback</h2><p>Missing code or state mismatch.</p></body></html>`
        );
        server.close();
        reject(new Error("Invalid OAuth callback (missing code or state mismatch)"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
        `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:48px;text-align:center;color:#111">
          <h2 style="margin:0 0 12px">You're signed in</h2>
          <p style="color:#666;margin:0">Return to your terminal — Neo CLI is ready.</p>
          <script>setTimeout(() => window.close(), 1500)</script>
        </body></html>`
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

export interface LoginResult {
  token: string;
  apiUrl: string;
  workspace?: { id: string; slug: string; name: string; plan: string };
}

export async function loginViaOAuth(apiUrl: string): Promise<LoginResult> {
  const port = await findFreePort();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const { verifier, challenge } = generatePkce();
  const state = base64url(randomBytes(16));

  info("Registering CLI as an OAuth client…");
  const regRes = await apiRequestUnauth<ClientRegistration>(apiUrl, "/api/register", {
    method: "POST",
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: "Neo CLI",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    }),
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

  // Fire-and-forget — some terminals never resolve open()
  open(authUrl.toString()).catch(() => {});

  const { code } = await waitForCallback(port, state, 5 * 60_000);

  info("Exchanging authorization code for API token…");
  const tokenRes = await apiRequestUnauth<TokenResponse>(apiUrl, "/api/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: redirectUri,
    }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!tokenRes.ok) {
    const description =
      (tokenRes.data as { error_description?: string; error?: string } | null)
        ?.error_description ??
      (tokenRes.data as { error?: string } | null)?.error ??
      `HTTP ${tokenRes.status}`;
    err(`Token exchange failed: ${description}`);
  }

  return {
    token: tokenRes.data.access_token,
    apiUrl,
    workspace: tokenRes.data.workspace,
  };
}
